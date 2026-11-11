const mockClientes = []

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn().mockImplementation((config) => {
    const cliente = {
      config,
      connected: false,
      activate: jest.fn(),
      deactivate: jest.fn(),
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    }
    mockClientes.push(cliente)
    return cliente
  }),
}))

let ws
let sesion

beforeEach(() => {
  jest.resetModules()
  mockClientes.length = 0
  localStorage.clear()
  ws = require('./websocket')
  sesion = require('../auth/sesion')
})

function conectar(cliente) {
  cliente.connected = true
  cliente.config.onConnect()
}

describe('websocket', () => {
  test('urlWebSocket convierte http en ws', () => {
    expect(ws.urlWebSocket()).toBe('ws://localhost:8080/ws')
  })

  test('comparte un solo cliente y lo activa al primer suscriptor', () => {
    ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    ws.suscribirse(ws.TOPIC_RUTAS, jest.fn())

    expect(mockClientes).toHaveLength(1)
    expect(mockClientes[0].activate).toHaveBeenCalledTimes(1)
    expect(mockClientes[0].config.brokerURL).toBe('ws://localhost:8080/ws')
  })

  test('se suscribe a los tópicos pendientes al conectar y entrega los mensajes', () => {
    const callback = jest.fn()
    ws.suscribirse(ws.TOPIC_PEDIDOS, callback)
    const cliente = mockClientes[0]

    expect(cliente.subscribe).not.toHaveBeenCalled()
    conectar(cliente)
    expect(cliente.subscribe).toHaveBeenCalledWith('/topic/pedidos', expect.any(Function))

    const alRecibir = cliente.subscribe.mock.calls[0][1]
    alRecibir({ body: JSON.stringify({ pedidoId: 3, estadoNuevo: 'ENTREGADO' }) })
    expect(callback).toHaveBeenCalledWith({ pedidoId: 3, estadoNuevo: 'ENTREGADO' })
  })

  test('ignora mensajes que no son JSON', () => {
    const callback = jest.fn()
    ws.suscribirse(ws.TOPIC_PEDIDOS, callback)
    conectar(mockClientes[0])

    mockClientes[0].subscribe.mock.calls[0][1]({ body: 'no es json' })

    expect(callback).not.toHaveBeenCalled()
  })

  test('si ya está conectado se suscribe de inmediato', () => {
    ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    conectar(mockClientes[0])

    ws.suscribirse(ws.TOPIC_RUTAS, jest.fn())

    expect(mockClientes[0].subscribe).toHaveBeenCalledWith('/topic/rutas', expect.any(Function))
  })

  test('cancelar la última suscripción de un tópico se desuscribe', () => {
    const cancelar = ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    conectar(mockClientes[0])
    const suscripcion = mockClientes[0].subscribe.mock.results[0].value

    cancelar()

    expect(suscripcion.unsubscribe).toHaveBeenCalled()
  })

  test('con varios callbacks solo se desuscribe al cancelar el último', () => {
    const cancelar1 = ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    const cancelar2 = ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    conectar(mockClientes[0])
    const suscripcion = mockClientes[0].subscribe.mock.results[0].value

    cancelar1()
    expect(suscripcion.unsubscribe).not.toHaveBeenCalled()
    cancelar2()
    expect(suscripcion.unsubscribe).toHaveBeenCalled()
  })

  test('cancelar con la conexión ya cerrada no lanza error', () => {
    const cancelar = ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    conectar(mockClientes[0])
    mockClientes[0].subscribe.mock.results[0].value.unsubscribe.mockImplementation(() => {
      throw new Error('conexión cerrada')
    })

    expect(() => cancelar()).not.toThrow()
  })

  test('alCambiarConexion avisa al conectar y al cerrarse', () => {
    const oyente = jest.fn()
    ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
    const cancelar = ws.alCambiarConexion(oyente)
    expect(oyente).toHaveBeenCalledWith(false) // estado actual

    conectar(mockClientes[0])
    expect(oyente).toHaveBeenLastCalledWith(true)
    mockClientes[0].config.onWebSocketClose()
    expect(oyente).toHaveBeenLastCalledWith(false)
    mockClientes[0].config.onStompError()
    expect(oyente).toHaveBeenLastCalledWith(false)

    const llamadas = oyente.mock.calls.length
    cancelar()
    mockClientes[0].config.onWebSocketClose()
    expect(oyente.mock.calls).toHaveLength(llamadas)
  })

  test('alCambiarConexion antes de crear el cliente no avisa todavía', () => {
    const oyente = jest.fn()
    ws.alCambiarConexion(oyente)
    expect(oyente).not.toHaveBeenCalled()
  })

  describe('token en el CONNECT', () => {
    test('sin sesión no manda Authorization', () => {
      expect(ws.cabecerasConexion()).toEqual({})
    })

    test('con sesión manda Authorization: Bearer en cada (re)conexión', () => {
      sesion.guardarSesion({ token: 'tok', rol: 'STAFF' })
      ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
      const cliente = mockClientes[0]

      cliente.config.beforeConnect(cliente)

      expect(cliente.connectHeaders).toEqual({ Authorization: 'Bearer tok' })
    })
  })

  describe('desconectar', () => {
    test('sin cliente no hace nada', () => {
      expect(() => ws.desconectar()).not.toThrow()
    })

    test('desactiva el cliente, avisa y permite abrir uno nuevo', () => {
      const oyente = jest.fn()
      ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
      ws.alCambiarConexion(oyente)

      ws.desconectar()

      expect(mockClientes[0].deactivate).toHaveBeenCalled()
      expect(oyente).toHaveBeenLastCalledWith(false)
      ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())
      expect(mockClientes).toHaveLength(2)
    })

    test('cerrar sesión (o un 401) corta la conexión', () => {
      sesion.guardarSesion({ token: 'tok', rol: 'STAFF' })
      ws.suscribirse(ws.TOPIC_PEDIDOS, jest.fn())

      sesion.cerrarSesion()

      expect(mockClientes[0].deactivate).toHaveBeenCalled()
    })
  })
})
