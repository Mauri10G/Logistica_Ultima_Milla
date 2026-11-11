import { AxiosError } from 'axios'
import { guardarSesion, obtenerSesion } from '../auth/sesion'
import { api, mensajeDeError } from './client'

beforeEach(() => localStorage.clear())

function conAdaptador(adaptador) {
  api.defaults.adapter = adaptador
}

function responder(config) {
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
}

function rechazar(status) {
  return async (config) => {
    throw new AxiosError('fallo', 'ERR_BAD_REQUEST', config, {}, { status, data: {}, config, headers: {} })
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

  test('un 401 borra la sesión', async () => {
    guardarSesion({ token: 'viejo', rol: 'STAFF' })
    conAdaptador(rechazar(401))

    await expect(api.get('/pedidos')).rejects.toBeDefined()

    expect(obtenerSesion()).toBeNull()
  })

  test('un 401 del login no borra la sesión (credenciales erróneas)', async () => {
    guardarSesion({ token: 'vigente', rol: 'STAFF' })
    conAdaptador(rechazar(401))

    await expect(api.post('/auth/login', {})).rejects.toBeDefined()

    expect(obtenerSesion()).not.toBeNull()
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
