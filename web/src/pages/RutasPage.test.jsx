import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listarRepartidores } from '../api/repartidoresApi'
import {
  armarRutas,
  cambiarRepartidorDeRuta,
  listarRutas,
  moverPedidoARuta,
  reordenarRuta,
  sacarPedidoDeRuta,
} from '../api/rutasApi'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import RutasPage from './RutasPage'

jest.mock('../api/rutasApi')
jest.mock('../api/repartidoresApi')
jest.mock('../hooks/useWebSocketTopic', () => ({ useWebSocketTopic: jest.fn() }))

let mockConectado = true
let mockAlegrarMensaje

function pedido(id, orden, extra = {}) {
  return {
    id,
    direccion: `Calle ${id}`,
    horaEntrega: '09:00:00',
    estado: 'ASIGNADO',
    latitud: -1.24 - id / 1000,
    longitud: -78.62,
    ordenEnRuta: orden,
    ...extra,
  }
}

const RUTAS = [
  {
    id: 5,
    zonaNombre: 'Centro',
    repartidorId: 1,
    repartidorNombre: 'Ana Pérez',
    estado: 'ARMADA',
    maxPedidos: 4,
    pedidos: [pedido(11, 1), pedido(12, 2), pedido(13, 3)],
  },
  {
    id: 6,
    zonaNombre: 'Norte',
    repartidorId: 2,
    repartidorNombre: 'Luis Mora',
    estado: 'ARMADA',
    maxPedidos: 4,
    pedidos: [pedido(21, 1)],
  },
]

const REPARTIDORES = [
  { id: 1, nombres: 'Ana Pérez', disponible: true, activo: true },
  { id: 2, nombres: 'Luis Mora', disponible: true, activo: true },
  { id: 3, nombres: 'Carlos Vera', disponible: false, activo: true },
  { id: 4, nombres: 'Dora Inactiva', disponible: true, activo: false },
]

function errorHttp(status, codigo, mensaje) {
  return { response: { status, data: { codigo, mensaje } } }
}

async function dibujar() {
  render(<RutasPage />)
  await screen.findByText('Ruta 5 · Centro')
}

beforeEach(() => {
  jest.resetAllMocks()
  mockConectado = true
  useWebSocketTopic.mockImplementation((topic, callback) => {
    mockAlegrarMensaje = callback
    return mockConectado
  })
  listarRutas.mockResolvedValue(RUTAS)
  listarRepartidores.mockResolvedValue(REPARTIDORES)
  armarRutas.mockResolvedValue([{ id: 5 }, { id: 6 }])
  for (const ajuste of [cambiarRepartidorDeRuta, moverPedidoARuta, sacarPedidoDeRuta, reordenarRuta]) {
    ajuste.mockResolvedValue({})
  }
})

describe('RutasPage: lista y armado', () => {
  test('carga las rutas de mañana por defecto y las muestra con su ocupación', async () => {
    await dibujar()

    expect(listarRutas).toHaveBeenCalledWith(fechaIso(1))
    expect(screen.getByText('Ruta 6 · Norte')).toBeInTheDocument()
    expect(screen.getByText(/Ana Pérez · 3\/4 pedidos/)).toBeInTheDocument()
    expect(screen.getAllByTestId('ruta-card')).toHaveLength(2)
  })

  test('el mapa dibuja una línea por ruta', async () => {
    await dibujar()

    expect(screen.getAllByTestId('polilinea')).toHaveLength(2)
  })

  test('sin rutas lo dice', async () => {
    listarRutas.mockResolvedValue([])
    render(<RutasPage />)

    expect(await screen.findByText('No hay rutas armadas para esta fecha.')).toBeInTheDocument()
  })

  test('muestra el error si falla la carga', async () => {
    listarRutas.mockRejectedValue(errorHttp(500, 'ERROR_INTERNO', 'Ocurrio un error interno'))
    render(<RutasPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('muestra el error si falla la carga de repartidores', async () => {
    listarRepartidores.mockRejectedValue(errorHttp(500, 'ERROR_INTERNO', 'Sin repartidores'))
    render(<RutasPage />)

    expect(await screen.findByText('Sin repartidores')).toBeInTheDocument()
  })

  test('Hoy y Mañana cambian la fecha consultada', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Hoy' }))
    await waitFor(() => expect(listarRutas).toHaveBeenLastCalledWith(fechaIso(0)))

    await user.click(screen.getByRole('button', { name: 'Mañana' }))
    await waitFor(() => expect(listarRutas).toHaveBeenLastCalledWith(fechaIso(1)))
  })

  test('Armar rutas informa cuántas se armaron', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Armar rutas' }))

    expect(armarRutas).toHaveBeenCalledWith(fechaIso(1))
    expect(await screen.findByText('Se armaron 2 ruta(s).')).toBeInTheDocument()
  })

  test('Armar rutas sin pedidos pendientes lo dice', async () => {
    const user = userEvent.setup()
    armarRutas.mockResolvedValue([])
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Armar rutas' }))

    expect(await screen.findByText('No había pedidos pendientes para esa fecha.')).toBeInTheDocument()
  })

  test('Armar rutas muestra el error del backend', async () => {
    const user = userEvent.setup()
    armarRutas.mockRejectedValue(errorHttp(422, 'SIN_REPARTIDORES', 'No hay repartidores disponibles para armar rutas'))
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Armar rutas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay repartidores disponibles')
  })
})

describe('RutasPage: tiempo real', () => {
  test('el indicador refleja la conexión', async () => {
    await dibujar()
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: conectado')
  })

  test('desconectado', async () => {
    mockConectado = false
    await dibujar()
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: desconectado')
  })

  test('un mensaje de /topic/rutas de la misma fecha recarga la lista', async () => {
    await dibujar()
    const cargas = listarRutas.mock.calls.length

    await act(async () => mockAlegrarMensaje({ tipo: 'RUTA_ACTUALIZADA', fecha: fechaIso(1), rutaIds: [5] }))

    await waitFor(() => expect(listarRutas.mock.calls.length).toBeGreaterThan(cargas))
  })

  test('un mensaje de otra fecha se ignora', async () => {
    await dibujar()
    const cargas = listarRutas.mock.calls.length

    await act(async () => mockAlegrarMensaje({ tipo: 'RUTAS_ARMADAS', fecha: '2000-01-01', rutaIds: [] }))

    expect(listarRutas.mock.calls.length).toBe(cargas)
  })
})

describe('RutasPage: ajustes manuales', () => {
  test('solo ofrece repartidores disponibles y activos', async () => {
    await dibujar()

    const select = screen.getByLabelText('Cambiar repartidor de la ruta 5')
    expect(select).toHaveTextContent('Ana Pérez')
    expect(select).toHaveTextContent('Luis Mora')
    expect(select).not.toHaveTextContent('Carlos Vera')
    expect(select).not.toHaveTextContent('Dora Inactiva')
  })

  test('cambiar repartidor llama al endpoint y recarga', async () => {
    const user = userEvent.setup()
    await dibujar()
    const cargas = listarRutas.mock.calls.length

    await user.selectOptions(screen.getByLabelText('Cambiar repartidor de la ruta 5'), '2')

    await waitFor(() => expect(cambiarRepartidorDeRuta).toHaveBeenCalledWith(5, 2))
    expect(await screen.findByText('Se cambió el repartidor de la ruta 5.')).toBeInTheDocument()
    expect(listarRutas.mock.calls.length).toBeGreaterThan(cargas)
  })

  test('mover un pedido a otra ruta', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.selectOptions(screen.getByLabelText('Mover el pedido 11 a otra ruta'), '6')

    await waitFor(() => expect(moverPedidoARuta).toHaveBeenCalledWith(6, 11))
    expect(await screen.findByText('El pedido 11 se movió a la ruta 6.')).toBeInTheDocument()
  })

  test('mover a una ruta llena muestra el error del backend', async () => {
    const user = userEvent.setup()
    moverPedidoARuta.mockRejectedValue(errorHttp(409, 'ESTADO_ILEGAL', 'La ruta ya tiene el maximo de 4 pedidos'))
    await dibujar()

    await user.selectOptions(screen.getByLabelText('Mover el pedido 11 a otra ruta'), '6')

    expect(await screen.findByRole('alert')).toHaveTextContent('La ruta ya tiene el maximo de 4 pedidos')
  })

  test('sacar un pedido de la ruta', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Sacar el pedido 12 de la ruta' }))

    await waitFor(() => expect(sacarPedidoDeRuta).toHaveBeenCalledWith(5, 12))
    expect(await screen.findByText(/El pedido 12 salió de la ruta 5 y volvió a PENDIENTE/)).toBeInTheDocument()
  })

  test('subir una parada envía el nuevo orden', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Subir la parada del pedido 12' }))

    await waitFor(() => expect(reordenarRuta).toHaveBeenCalledWith(5, [12, 11, 13]))
    expect(await screen.findByText('Se cambió el orden de las paradas de la ruta 5.')).toBeInTheDocument()
  })

  test('bajar una parada envía el nuevo orden', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Bajar la parada del pedido 11' }))

    await waitFor(() => expect(reordenarRuta).toHaveBeenCalledWith(5, [12, 11, 13]))
  })

  test.each([
    ['404 del enrutador (el endpoint no existe)', errorHttp(404, 'NOT_FOUND', 'Not Found')],
    ['405 (método no permitido)', errorHttp(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed')],
  ])('%s: avisa que la función estará disponible cuando el backend la publique', async (_nombre, error) => {
    const user = userEvent.setup()
    cambiarRepartidorDeRuta.mockRejectedValue(error)
    await dibujar()

    await user.selectOptions(screen.getByLabelText('Cambiar repartidor de la ruta 5'), '2')

    expect(await screen.findByRole('alert')).toHaveTextContent('Función disponible cuando el backend la publique')
  })

  test('un 404 de un recurso inexistente no se confunde con un endpoint ausente', async () => {
    const user = userEvent.setup()
    sacarPedidoDeRuta.mockRejectedValue(errorHttp(404, 'RECURSO_NO_ENCONTRADO', 'No existe el pedido con id 12'))
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Sacar el pedido 12 de la ruta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe el pedido con id 12')
  })

  test('los controles se bloquean mientras se ejecuta un ajuste', async () => {
    const user = userEvent.setup()
    let terminar
    reordenarRuta.mockReturnValue(new Promise((resolver) => (terminar = resolver)))
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Subir la parada del pedido 12' }))

    expect(screen.getByRole('button', { name: 'Sacar el pedido 11 de la ruta' })).toBeDisabled()
    await act(async () => terminar({}))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sacar el pedido 11 de la ruta' })).toBeEnabled())
  })

  test('las rutas que ya salieron no ofrecen ajustes', async () => {
    listarRutas.mockResolvedValue([{ ...RUTAS[0], estado: 'EN_CURSO' }])
    await dibujar()

    expect(screen.queryByLabelText(/Cambiar repartidor/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sacar/ })).not.toBeInTheDocument()
  })
})
