import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { listarPedidos } from '../api/pedidosApi'
import { listarRepartidores } from '../api/repartidoresApi'
import { listarRutas } from '../api/rutasApi'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_PEDIDOS, TOPIC_RUTAS } from '../services/websocket'
import InicioPage from './InicioPage'

jest.mock('../api/pedidosApi')
jest.mock('../api/repartidoresApi')
jest.mock('../api/rutasApi')
jest.mock('../hooks/useWebSocketTopic', () => ({ useWebSocketTopic: jest.fn() }))

let mockConectado
let alRecibir

const PEDIDOS = [
  { id: 1, estado: 'PENDIENTE' },
  { id: 2, estado: 'PENDIENTE' },
  { id: 3, estado: 'EN_CAMINO' },
  { id: 4, estado: 'ENTREGADO' },
]
const RUTAS_HOY = [
  { id: 1, estado: 'ARMADA' },
  { id: 2, estado: 'ARMADA' },
  { id: 3, estado: 'EN_CURSO' },
]
const RUTAS_MANANA = [{ id: 9, estado: 'ARMADA' }]
const REPARTIDORES = [
  { id: 1, nombres: 'Ana', disponible: true, activo: true },
  { id: 2, nombres: 'Luis', disponible: false, activo: true },
  { id: 3, nombres: 'Eva', disponible: true, activo: false },
]

function dibujar() {
  return render(
    <MemoryRouter>
      <InicioPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  jest.resetAllMocks()
  mockConectado = true
  alRecibir = {}
  useWebSocketTopic.mockImplementation((topic, callback) => {
    alRecibir[topic] = callback
    return mockConectado
  })
  listarPedidos.mockResolvedValue({ pedidos: PEDIDOS, total: 4 })
  listarRutas.mockImplementation(async (fecha) => (fecha === fechaIso(0) ? RUTAS_HOY : RUTAS_MANANA))
  listarRepartidores.mockResolvedValue(REPARTIDORES)
})

describe('InicioPage', () => {
  test('muestra el título y el indicador de tiempo real', async () => {
    dibujar()

    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: conectado')
    await screen.findByText('de 2 repartidores activos')
  })

  test('cuenta los pedidos de hoy por estado, con las mismas clases de color que las tablas', async () => {
    dibujar()

    await screen.findByText('2 pendientes de asignar a una ruta')
    expect(listarPedidos).toHaveBeenCalledWith({ fecha: fechaIso(0), size: 1000 })
    const tarjetas = screen.getByRole('list', { name: 'Pedidos de hoy por estado' })
    const esperado = { Pendiente: '2', Asignado: '0', Recogido: '0', 'En camino': '1', Entregado: '1' }
    for (const [etiqueta, cantidad] of Object.entries(esperado)) {
      const tarjeta = within(tarjetas).getByText(etiqueta).closest('li')
      expect(tarjeta).toHaveTextContent(`${etiqueta}${cantidad}`)
    }
    expect(within(tarjetas).getByText('En camino')).toHaveClass('badge-EN_CAMINO')
  })

  test('muestra el total de pedidos, las rutas armadas y los repartidores disponibles', async () => {
    dibujar()

    expect(await screen.findByText('1 en curso · 1 armadas para mañana')).toBeInTheDocument()
    expect(listarRutas).toHaveBeenCalledWith(fechaIso(0))
    expect(listarRutas).toHaveBeenCalledWith(fechaIso(1))
    const tarjeta = (titulo) => screen.getByText(titulo).closest('article')
    expect(tarjeta('Pedidos de hoy')).toHaveTextContent('4')
    expect(tarjeta('Rutas armadas hoy')).toHaveTextContent('2')
    // Eva está disponible pero inactiva: no cuenta
    expect(tarjeta('Repartidores disponibles')).toHaveTextContent('1')
    expect(screen.getByText('de 2 repartidores activos')).toBeInTheDocument()
  })

  test('mientras llegan los datos las tarjetas indican que están cargando', () => {
    listarPedidos.mockReturnValue(new Promise(() => {}))
    listarRutas.mockReturnValue(new Promise(() => {}))
    listarRepartidores.mockReturnValue(new Promise(() => {}))
    dibujar()

    expect(screen.getAllByText('Consultando…')).toHaveLength(3)
    expect(screen.getByRole('list', { name: 'Pedidos de hoy por estado' })).toHaveAttribute('aria-busy', 'true')
  })

  test('tiene accesos rápidos a cada sección', async () => {
    dibujar()
    await screen.findByText('de 2 repartidores activos')

    const destinos = {
      'Registrar pedidos': '/pedidos',
      'Armar rutas': '/rutas',
      Seguimiento: '/seguimiento',
      'Zonas de reparto': '/zonas',
      Repartidores: '/repartidores',
    }
    for (const [nombre, ruta] of Object.entries(destinos)) {
      expect(screen.getByRole('link', { name: new RegExp(nombre) })).toHaveAttribute('href', ruta)
    }
  })

  test('un error al cargar los pedidos se avisa con un toast de error', async () => {
    listarPedidos.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Ocurrio un error interno' } } })
    dibujar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('si una consulta falla la tarjeta no queda cargando para siempre', async () => {
    listarPedidos.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Ocurrio un error interno' } } })
    dibujar()

    await screen.findByRole('alert')
    await screen.findByText('de 2 repartidores activos')
    expect(screen.getByText('No se pudo cargar')).toBeInTheDocument()
    expect(screen.queryByText('Consultando…')).not.toBeInTheDocument()
    expect(screen.getByText('Pedidos de hoy').closest('article')).toHaveTextContent('—')
    expect(screen.getByRole('list', { name: 'Pedidos de hoy por estado' })).toHaveAttribute('aria-busy', 'false')
  })

  test('un error al cargar las rutas se avisa', async () => {
    listarRutas.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Fallo de rutas' } } })
    dibujar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo de rutas')
  })

  test('un error al cargar los repartidores se avisa', async () => {
    listarRepartidores.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Fallo de repartidores' } } })
    dibujar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo de repartidores')
  })

  test('el tiempo real recarga los pedidos y las rutas', async () => {
    dibujar()
    await screen.findByText('2 pendientes de asignar a una ruta')

    listarPedidos.mockResolvedValue({ pedidos: [...PEDIDOS, { id: 5, estado: 'PENDIENTE' }], total: 5 })
    await act(async () => alRecibir[TOPIC_PEDIDOS]({ pedidoId: 5 }))
    expect(await screen.findByText('3 pendientes de asignar a una ruta')).toBeInTheDocument()

    listarRutas.mockImplementation(async (fecha) => (fecha === fechaIso(0) ? [] : RUTAS_MANANA))
    await act(async () => alRecibir[TOPIC_RUTAS]({ fecha: fechaIso(0) }))
    await waitFor(() => expect(screen.getByText('0 en curso · 1 armadas para mañana')).toBeInTheDocument())
  })

  test('desconectado se refleja en el indicador', async () => {
    mockConectado = false
    dibujar()

    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: desconectado')
    await screen.findByText('de 2 repartidores activos')
  })
})
