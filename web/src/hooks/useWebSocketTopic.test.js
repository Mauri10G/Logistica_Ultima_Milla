import { act, renderHook } from '@testing-library/react'
import { alCambiarConexion, suscribirse } from '../services/websocket'
import { useWebSocketTopic } from './useWebSocketTopic'

jest.mock('../services/websocket', () => ({
  suscribirse: jest.fn(),
  alCambiarConexion: jest.fn(),
}))

let avisarConexion
let enviarMensaje
const cancelarSuscripcion = jest.fn()
const cancelarConexion = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  alCambiarConexion.mockImplementation((oyente) => {
    avisarConexion = oyente
    return cancelarConexion
  })
  suscribirse.mockImplementation((topic, callback) => {
    enviarMensaje = callback
    return cancelarSuscripcion
  })
})

describe('useWebSocketTopic', () => {
  test('se suscribe al tópico y empieza desconectado', () => {
    const { result } = renderHook(() => useWebSocketTopic('/topic/pedidos', jest.fn()))

    expect(suscribirse).toHaveBeenCalledWith('/topic/pedidos', expect.any(Function))
    expect(result.current).toBe(false)
  })

  test('refleja el estado de la conexión', () => {
    const { result } = renderHook(() => useWebSocketTopic('/topic/pedidos', jest.fn()))

    act(() => avisarConexion(true))
    expect(result.current).toBe(true)
    act(() => avisarConexion(false))
    expect(result.current).toBe(false)
  })

  test('entrega los mensajes al callback más reciente sin volver a suscribirse', () => {
    const primero = jest.fn()
    const segundo = jest.fn()
    const { rerender } = renderHook(({ callback }) => useWebSocketTopic('/topic/pedidos', callback), {
      initialProps: { callback: primero },
    })

    rerender({ callback: segundo })
    enviarMensaje({ pedidoId: 1 })

    expect(primero).not.toHaveBeenCalled()
    expect(segundo).toHaveBeenCalledWith({ pedidoId: 1 })
    expect(suscribirse).toHaveBeenCalledTimes(1)
  })

  test('al desmontar cancela la suscripción y el oyente de conexión', () => {
    const { unmount } = renderHook(() => useWebSocketTopic('/topic/rutas', jest.fn()))

    unmount()

    expect(cancelarSuscripcion).toHaveBeenCalled()
    expect(cancelarConexion).toHaveBeenCalled()
  })
})
