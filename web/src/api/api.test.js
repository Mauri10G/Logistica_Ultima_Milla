import { iniciarSesionApi } from './authApi'
import { api } from './client'
import {
  cambiarEstadoPedido,
  crearPedido,
  editarPedido,
  eliminarPedido,
  listarPedidos,
  obtenerHoraServidor,
} from './pedidosApi'
import { cambiarDisponibilidad, crearRepartidor, listarRepartidores } from './repartidoresApi'
import {
  armarRutas,
  cambiarRepartidorDeRuta,
  listarRutas,
  moverPedidoARuta,
  reordenarRuta,
  sacarPedidoDeRuta,
} from './rutasApi'
import { obtenerHistorial } from './seguimientoApi'
import { actualizarZona, crearZona, listarZonas } from './zonasApi'

jest.mock('./client', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}))

beforeEach(() => {
  jest.resetAllMocks()
  for (const metodo of ['get', 'post', 'put', 'patch', 'delete']) api[metodo].mockResolvedValue({ data: 'resultado' })
})

describe('pedidosApi', () => {
  test('listarPedidos envía solo los filtros con valor y lee X-Total-Count', async () => {
    api.get.mockResolvedValue({ data: [{ id: 1 }], headers: { 'x-total-count': '57' } })

    const resultado = await listarPedidos({ fecha: '2026-03-01', zonaId: '2', estado: '', size: 50 })

    expect(api.get).toHaveBeenCalledWith('/pedidos', {
      params: { page: 0, size: 50, fecha: '2026-03-01', zonaId: '2' },
    })
    expect(resultado).toEqual({ pedidos: [{ id: 1 }], total: 57 })
  })

  test('listarPedidos usa el largo de la lista si falta la cabecera y acepta llamarse sin argumentos', async () => {
    api.get.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], headers: {} })

    const resultado = await listarPedidos()

    expect(api.get).toHaveBeenCalledWith('/pedidos', { params: { page: 0, size: 100 } })
    expect(resultado.total).toBe(2)
  })

  test('listarPedidos envía el estado cuando se elige', async () => {
    api.get.mockResolvedValue({ data: [], headers: {} })
    await listarPedidos({ estado: 'PENDIENTE' })
    expect(api.get).toHaveBeenCalledWith('/pedidos', { params: { page: 0, size: 100, estado: 'PENDIENTE' } })
  })

  test('crear, editar, eliminar y cambiar estado', async () => {
    expect(await crearPedido({ a: 1 })).toBe('resultado')
    expect(api.post).toHaveBeenCalledWith('/pedidos', { a: 1 })

    expect(await editarPedido(4, { b: 2 })).toBe('resultado')
    expect(api.put).toHaveBeenCalledWith('/pedidos/4', { b: 2 })

    await eliminarPedido(4)
    expect(api.delete).toHaveBeenCalledWith('/pedidos/4')

    await cambiarEstadoPedido(4, 'RECOGIDO')
    expect(api.patch).toHaveBeenCalledWith('/pedidos/4/estado', { estado: 'RECOGIDO', origen: 'WEB' })
  })
})

describe('hora del servidor', () => {
  test('obtenerHoraServidor lee GET /servidor/hora', async () => {
    const hora = { fecha: '2031-05-17', hora: '19:15:00', zonaHoraria: 'America/Guayaquil' }
    api.get.mockResolvedValue({ data: hora })

    expect(await obtenerHoraServidor()).toEqual(hora)
    expect(api.get).toHaveBeenCalledWith('/servidor/hora')
  })

  test('obtenerHoraServidor propaga el error si el endpoint no responde', async () => {
    api.get.mockRejectedValue(new Error('Network Error'))

    await expect(obtenerHoraServidor()).rejects.toThrow('Network Error')
  })
})

describe('zonasApi', () => {
  test('listar, crear y actualizar con confirmarSuperposicion', async () => {
    expect(await listarZonas()).toBe('resultado')
    expect(api.get).toHaveBeenCalledWith('/zonas')

    await crearZona({ nombre: 'Z' })
    expect(api.post).toHaveBeenCalledWith('/zonas', { nombre: 'Z' }, { params: { confirmarSuperposicion: false } })

    await actualizarZona(3, { nombre: 'Z' }, true)
    expect(api.put).toHaveBeenCalledWith('/zonas/3', { nombre: 'Z' }, { params: { confirmarSuperposicion: true } })
  })
})

describe('rutasApi', () => {
  test('listar y armar por fecha', async () => {
    await listarRutas('2026-03-01')
    expect(api.get).toHaveBeenCalledWith('/rutas', { params: { fecha: '2026-03-01' } })

    await armarRutas('2026-03-01')
    expect(api.post).toHaveBeenCalledWith('/rutas/armar', null, { params: { fecha: '2026-03-01' } })
  })

  test('los cuatro ajustes manuales siguen el contrato acordado', async () => {
    await cambiarRepartidorDeRuta(5, 9)
    expect(api.patch).toHaveBeenCalledWith('/rutas/5/repartidor', { repartidorId: 9 })

    await moverPedidoARuta(5, 12)
    expect(api.post).toHaveBeenCalledWith('/rutas/5/pedidos/12')

    await sacarPedidoDeRuta(5, 12)
    expect(api.delete).toHaveBeenCalledWith('/rutas/5/pedidos/12')

    await reordenarRuta(5, [3, 1, 2])
    expect(api.put).toHaveBeenCalledWith('/rutas/5/orden', { pedidos: [3, 1, 2] })
  })
})

describe('repartidoresApi, seguimientoApi y authApi', () => {
  test('repartidores', async () => {
    await listarRepartidores()
    expect(api.get).toHaveBeenCalledWith('/repartidores')
    await crearRepartidor({ nombres: 'Ana' })
    expect(api.post).toHaveBeenCalledWith('/repartidores', { nombres: 'Ana' })
    await cambiarDisponibilidad(2, false)
    expect(api.patch).toHaveBeenCalledWith('/repartidores/2/disponibilidad', { disponible: false })
  })

  test('historial de un pedido', async () => {
    await obtenerHistorial(8)
    expect(api.get).toHaveBeenCalledWith('/seguimiento/pedidos/8/historial')
  })

  test('login devuelve token, rol y repartidorId (null si falta)', async () => {
    api.post.mockResolvedValue({ data: { token: 't', rol: 'STAFF' } })

    const sesion = await iniciarSesionApi('admin', 'clave')

    expect(api.post).toHaveBeenCalledWith('/auth/login', { usuario: 'admin', clave: 'clave' })
    expect(sesion).toEqual({ token: 't', rol: 'STAFF', repartidorId: null })
  })

  test('login con repartidor conserva su id', async () => {
    api.post.mockResolvedValue({ data: { token: 't', rol: 'COURIER', repartidorId: 6 } })
    expect((await iniciarSesionApi('r', 'c')).repartidorId).toBe(6)
  })
})
