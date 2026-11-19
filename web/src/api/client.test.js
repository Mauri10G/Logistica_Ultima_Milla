import { AxiosError } from 'axios'
import { guardarSesion, MENSAJE_SESION_EXPIRADA, obtenerAvisoSesion, obtenerSesion } from '../auth/sesion'
import { MENSAJE_ACCESO_DENEGADO } from '../utils/errores'
import { api, mensajeDeError } from './client'

beforeEach(() => localStorage.clear())

function conAdaptador(adaptador) {
  api.defaults.adapter = adaptador
}

function responder(config) {
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
}

function rechazar(status, codigo) {
  return async (config) => {
    const data = codigo ? { status, codigo, mensaje: 'x' } : {}
    throw new AxiosError('fallo', 'ERR_BAD_REQUEST', config, {}, { status, data, config, headers: {} })
  }
}

describe('client', () => {
  test('usa /api del backend como base', () => {
    expect(api.defaults.baseURL).toBe('http://localhost:8080/api')
  })

  test('envía Authorization: Bearer cuando hay sesión', async () => {
    guardarSesion({ token: 'tok123', rol: 'STAFF' })
    let enviado
    conAdaptador(async (config) => {
      enviado = config.headers.Authorization
      return responder(config)
    })

    await api.get('/pedidos')

    expect(enviado).toBe('Bearer tok123')
  })

  test('no envía Authorization sin sesión', async () => {
    let enviado = 'x'
    conAdaptador(async (config) => {
      enviado = config.headers.Authorization
      return responder(config)
    })

    await api.get('/pedidos')

    expect(enviado).toBeUndefined()
  })

  test('un 401 NO_AUTENTICADO borra la sesión y deja el aviso de sesión expirada', async () => {
    guardarSesion({ token: 'viejo', rol: 'STAFF' })
    conAdaptador(rechazar(401, 'NO_AUTENTICADO'))

    await expect(api.get('/pedidos')).rejects.toBeDefined()

    expect(obtenerSesion()).toBeNull()
    expect(obtenerAvisoSesion()).toBe(MENSAJE_SESION_EXPIRADA)
  })

  test('un 401 del login (CREDENCIALES_INVALIDAS) no borra la sesión', async () => {
    guardarSesion({ token: 'vigente', rol: 'STAFF' })
    conAdaptador(rechazar(401, 'CREDENCIALES_INVALIDAS'))

    await expect(api.post('/auth/login', {})).rejects.toBeDefined()

    expect(obtenerSesion()).not.toBeNull()
  })

  test('un 403 ACCESO_DENEGADO no cierra la sesión y se explica con un aviso claro', async () => {
    guardarSesion({ token: 'vigente', rol: 'STAFF' })
    conAdaptador(rechazar(403, 'ACCESO_DENEGADO'))

    const error = await api.get('/zonas').catch((e) => e)

    expect(obtenerSesion()).not.toBeNull()
    expect(obtenerAvisoSesion()).toBeNull()
    expect(mensajeDeError(error)).toBe(MENSAJE_ACCESO_DENEGADO)
  })

  test('otros errores no tocan la sesión', async () => {
    guardarSesion({ token: 'vigente', rol: 'STAFF' })
    conAdaptador(rechazar(500))

    await expect(api.get('/pedidos')).rejects.toBeDefined()

    expect(obtenerSesion()).not.toBeNull()
  })

  test('reexporta mensajeDeError', () => {
    expect(mensajeDeError(new Error('x'))).toBe('x')
  })
})
