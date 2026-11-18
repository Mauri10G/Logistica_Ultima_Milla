import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { consultarPedidos } from '../__mocks__/backendPedidos'
import { listarPedidos } from '../api/pedidosApi'
import { obtenerHistorial } from '../api/seguimientoApi'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import SeguimientoPage from './SeguimientoPage'

jest.mock('../api/pedidosApi')
jest.mock('../api/seguimientoApi')
jest.mock('../hooks/useWebSocketTopic', () => ({ useWebSocketTopic: jest.fn() }))

let mockConectado = true
let mockRecibirCambio

const PEDIDOS = [
  { id: 1, clienteNombres: 'Maria Torres', direccion: 'Bolívar y Mera', zonaNombre: 'Centro', rutaId: 5, estado: 'EN_CAMINO' },
  { id: 2, clienteNombres: 'Luis Mora', direccion: 'Cevallos y Sucre', zonaNombre: 'Norte', rutaId: null, estado: 'PENDIENTE' },
  { id: 3, clienteNombres: 'Ana Ruiz', direccion: 'Montalvo', zonaNombre: 'Centro', rutaId: 5, estado: 'ENTREGADO' },
]

const HISTORIAL = [
  { id: 1, pedidoId: 1, estadoAnterior: null, estadoNuevo: 'PENDIENTE', fechaCambio: '2026-03-01T08:00:00', origen: 'WEB' },
  { id: 2, pedidoId: 1, estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', fechaCambio: '2026-03-01T18:00:00', origen: 'WEB' },
]

// Simula el backend con los pedidos de `backend`: filtra por estado, busca (q), ordena (sort), pagina con page/size y devuelve el total de todas las páginas.
let backend

function servir(pedidos) {
  backend = pedidos
  listarPedidos.mockImplementation(async (consulta = {}) => consultarPedidos(backend, consulta))
}

function cambio(pedidoId, estadoNuevo, estadoAnterior = 'EN_CAMINO') {
  return { pedidoId, estadoAnterior, estadoNuevo, origen: 'MOVIL', fechaCambio: '2026-03-02T10:00:00' }
}

async function dibujar() {
  render(<SeguimientoPage />)
  await screen.findByText('Maria Torres')
}

beforeEach(() => {
  jest.resetAllMocks()
  mockConectado = true
  useWebSocketTopic.mockImplementation((topic, callback) => {
    mockRecibirCambio = callback
    return mockConectado
  })
  servir(PEDIDOS)
  obtenerHistorial.mockResolvedValue(HISTORIAL)
})

describe('SeguimientoPage: tabla y resumen', () => {
  test('carga los pedidos de hoy y cuenta cuántos hay por estado', async () => {
    await dibujar()

    expect(listarPedidos).toHaveBeenCalledWith({ fecha: fechaIso(0), estado: '', q: '', sort: 'id,asc', page: 0, size: 10 }) // la página
    expect(listarPedidos).toHaveBeenCalledWith({ fecha: fechaIso(0), estado: 'PENDIENTE', size: 1 }) // el total de cada pastilla
    expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('En camino')
    const resumen = await screen.findByRole('list', { name: 'Filtrar por estado' })
    await waitFor(() => expect(resumen).toHaveTextContent('En camino 1'))
    expect(resumen).toHaveTextContent('En camino 1')
    expect(resumen).toHaveTextContent('Pendiente 1')
    expect(resumen).toHaveTextContent('Entregado 1')
    expect(resumen).toHaveTextContent('Asignado 0')
    expect(screen.getByText('—')).toBeInTheDocument() // pedido sin ruta
  })

  test('sin pedidos lo dice', async () => {
    servir([])
    render(<SeguimientoPage />)

    expect(await screen.findByText('No hay pedidos para esta fecha.')).toBeInTheDocument()
  })

  test('muestra el error si falla la carga', async () => {
    listarPedidos.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Ocurrio un error interno' } } })
    render(<SeguimientoPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('cambiar la fecha o usar Mañana vuelve a consultar', async () => {
    const user = userEvent.setup()
    await dibujar()

    const consultaDe = (fecha) => expect(listarPedidos).toHaveBeenCalledWith({ fecha, estado: '', q: '', sort: 'id,asc', page: 0, size: 10 })

    fireEvent.change(screen.getByLabelText('Fecha de entrega'), { target: { value: '2026-03-10' } })
    await waitFor(() => consultaDe('2026-03-10'))

    await user.click(screen.getByRole('button', { name: 'Mañana' }))
    await waitFor(() => consultaDe(fechaIso(1)))

    listarPedidos.mockClear()
    await user.click(screen.getByRole('button', { name: 'Hoy' }))
    await waitFor(() => consultaDe(fechaIso(0)))
  })

  test('el indicador muestra si el tiempo real está conectado', async () => {
    await dibujar()
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: conectado')
  })

  test('el indicador muestra si está desconectado', async () => {
    mockConectado = false
    await dibujar()
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: desconectado')
  })
})

describe('SeguimientoPage: tiempo real (CP-11)', () => {
  test('un cambio por WebSocket actualiza la fila al instante y las pastillas con los totales del backend', async () => {
    await dibujar()
    await screen.findByRole('button', { name: /^Entregado 1$/ })
    servir(backend.map((pedido) => (pedido.id === 1 ? { ...pedido, estado: 'ENTREGADO' } : pedido))) // lo que ya sabe el backend

    act(() => mockRecibirCambio(cambio(1, 'ENTREGADO')))

    expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('Entregado')
    expect(screen.getByTestId('estado-pedido-2')).toHaveTextContent('Pendiente')
    expect(await screen.findByRole('button', { name: /^Entregado 2$/ })).toBeInTheDocument()
  })

  test('sin filtro de estado un cambio por WebSocket no vuelve a pedir la página, solo los totales', async () => {
    await dibujar()
    await screen.findByRole('button', { name: /^Entregado 1$/ })
    listarPedidos.mockClear()

    act(() => mockRecibirCambio(cambio(1, 'ENTREGADO')))
    await waitFor(() => expect(listarPedidos).toHaveBeenCalledTimes(5)) // una consulta de total por estado

    expect(listarPedidos.mock.calls.every(([filtros]) => filtros.size === 1)).toBe(true)
  })

  test('la fila actualizada se resalta unos segundos', async () => {
    jest.useFakeTimers()
    try {
      await dibujar()

      act(() => mockRecibirCambio(cambio(1, 'ENTREGADO')))
      const fila = screen.getByTestId('estado-pedido-1').closest('tr')
      expect(fila).toHaveClass('fila-actualizada')

      act(() => jest.advanceTimersByTime(3100))
      expect(fila).not.toHaveClass('fila-actualizada')
    } finally {
      jest.useRealTimers()
    }
  })

  test('un cambio de un pedido que no está en la lista se ignora', async () => {
    await dibujar()

    act(() => mockRecibirCambio(cambio(999, 'ENTREGADO')))

    expect(screen.getByTestId('estado-pedido-3')).toHaveTextContent('Entregado')
    expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('En camino')
  })
})

describe('SeguimientoPage: historial del pedido', () => {
  test('no hay panel hasta elegir un pedido', async () => {
    await dibujar()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  test('al elegir un pedido muestra su historial', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))

    expect(obtenerHistorial).toHaveBeenCalledWith(1)
    const panel = await screen.findByRole('complementary', { name: 'Historial del pedido 1' })
    expect(panel).toHaveTextContent('Maria Torres')
    expect(await screen.findByText('2026-03-01 18:00:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver historial del pedido 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('se recarga solo si llega un cambio de ese pedido', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))
    await screen.findByText('2026-03-01 18:00:00')
    expect(obtenerHistorial).toHaveBeenCalledTimes(1)

    await act(async () => mockRecibirCambio(cambio(1, 'ENTREGADO')))

    await waitFor(() => expect(obtenerHistorial).toHaveBeenCalledTimes(2))
  })

  test('un cambio de otro pedido no recarga el historial', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))
    await screen.findByText('2026-03-01 18:00:00')

    await act(async () => mockRecibirCambio(cambio(3, 'ENTREGADO', 'EN_CAMINO')))

    expect(obtenerHistorial).toHaveBeenCalledTimes(1)
  })

  test('cambiar de pedido reemplaza el historial', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))
    await screen.findByRole('complementary', { name: 'Historial del pedido 1' })

    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 2' }))

    expect(await screen.findByRole('complementary', { name: 'Historial del pedido 2' })).toBeInTheDocument()
    expect(obtenerHistorial).toHaveBeenLastCalledWith(2)
  })

  test('muestra el error si falla', async () => {
    const user = userEvent.setup()
    obtenerHistorial.mockRejectedValue({ response: { status: 404, data: { mensaje: 'No existe el pedido con id 1' } } })
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))

    const panel = await screen.findByRole('complementary')
    expect(await screen.findByText('No existe el pedido con id 1')).toBeInTheDocument()
    expect(panel).toBeInTheDocument()
  })

  test('Cerrar historial oculta el panel', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))
    await screen.findByRole('complementary')

    await user.click(screen.getByRole('button', { name: 'Cerrar historial' }))

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})

function pedidoSeg(n, extra = {}) {
  return {
    id: n,
    clienteNombres: `Cliente ${String(n).padStart(2, '0')}`,
    direccion: `Calle ${n}`,
    zonaNombre: 'Centro',
    rutaId: null,
    horaEntrega: `${String(8 + (n % 10)).padStart(2, '0')}:00:00`,
    estado: 'PENDIENTE',
    ...extra,
  }
}

const idsSeg = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((fila) => Number(fila.cells[0].textContent))

describe('SeguimientoPage: orden, búsqueda y paginación', () => {
  test('viene ordenado por # de menor a mayor, y ese orden se lo pide al backend', async () => {
    servir([PEDIDOS[2], PEDIDOS[0], PEDIDOS[1]])
    await dibujar()

    expect(idsSeg()).toEqual([1, 2, 3])
    expect(listarPedidos).toHaveBeenCalledWith(expect.objectContaining({ sort: 'id,asc', page: 0, size: 10 }))
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).not.toHaveAttribute('aria-sort')
  })

  test('el usuario cambia el orden con los encabezados y el backend lo ordena', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Cliente' }))
    await waitFor(() => expect(idsSeg()).toEqual([3, 2, 1])) // Ana, Luis, Maria
    expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'cliente,asc', page: 0 }))

    await user.click(screen.getByRole('button', { name: 'Cliente' }))
    await waitFor(() => expect(idsSeg()).toEqual([1, 2, 3]))
    expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'cliente,desc' }))
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).toHaveAttribute('aria-sort', 'descending')
  })

  test('la columna Hora ordena por hora de entrega (sort=fechaEntrega)', async () => {
    const user = userEvent.setup()
    servir([pedidoSeg(1, { horaEntrega: '15:00:00' }), pedidoSeg(2, { horaEntrega: '09:30:00' }), pedidoSeg(3, { horaEntrega: '11:00:00' })])
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')

    await user.click(screen.getByRole('button', { name: 'Hora' }))

    await waitFor(() => expect(idsSeg()).toEqual([2, 3, 1]))
    expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'fechaEntrega,asc' }))
    expect(screen.getByText('09:30')).toBeInTheDocument()
  })

  test.each([
    ['#', 'id,desc'],
    ['Dirección', 'direccion,asc'],
    ['Zona', 'zona,asc'],
    ['Estado', 'estado,asc'],
  ])('el encabezado %s pide sort=%s', async (titulo, esperado) => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: titulo }))

    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ sort: esperado })))
  })

  test('Ruta e Historial no ordenan: el backend no ordena por esas columnas', async () => {
    await dibujar()

    expect(screen.queryByRole('button', { name: 'Ruta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Historial' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Ruta' })).toBeInTheDocument()
  })

  test('al recargar la pantalla vuelve al orden por #', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SeguimientoPage />)
    await screen.findByText('Maria Torres')
    await user.click(screen.getByRole('button', { name: 'Cliente' }))
    await waitFor(() => expect(idsSeg()).toEqual([3, 2, 1]))

    unmount()
    render(<SeguimientoPage />)
    await screen.findByText('Maria Torres')

    expect(idsSeg()).toEqual([1, 2, 3])
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).not.toHaveAttribute('aria-sort')
  })

  test('el buscador manda q al backend y filtra por cliente o dirección', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por cliente o dirección' }), 'montalvo')
    await waitFor(() => expect(idsSeg()).toEqual([3]))
    expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'montalvo', page: 0, size: 10 }))

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'luis')
    await waitFor(() => expect(idsSeg()).toEqual([2]))

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(await screen.findByText('No hay pedidos para esta fecha.')).toBeInTheDocument()
  })

  test('pagina de a 10 con "Mostrando 1 a 10 de 24" y vuelve a la página 1 al buscar', async () => {
    const user = userEvent.setup()
    servir(Array.from({ length: 24 }, (_, i) => pedidoSeg(i + 1)))
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')

    expect(screen.getByText('Mostrando 1 a 10 de 24')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByText('Mostrando 11 a 20 de 24')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox'), 'cliente')
    expect(await screen.findByText('Mostrando 1 a 10 de 24')).toBeInTheDocument()
  })

  test('cada página es una consulta al backend y las pastillas cuentan todo el día, no solo la página', async () => {
    const user = userEvent.setup()
    servir(Array.from({ length: 24 }, (_, i) => pedidoSeg(i + 1)))
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')

    expect(await screen.findByRole('button', { name: /^Todos 24$/ })).toBeInTheDocument()
    expect(idsSeg()).toHaveLength(10)

    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10 })))
    expect(await screen.findByText('Mostrando 11 a 20 de 24')).toBeInTheDocument()
    expect(idsSeg()).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  })

  test('buscar encuentra pedidos de cualquier página con una consulta de una página al backend', async () => {
    const user = userEvent.setup()
    servir(Array.from({ length: 24 }, (_, i) => pedidoSeg(i + 1)))
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')
    expect(idsSeg()).not.toContain(23)

    await user.type(screen.getByRole('searchbox'), 'Cliente 23')

    await waitFor(() => expect(idsSeg()).toEqual([23]))
    expect(listarPedidos).toHaveBeenLastCalledWith(
      expect.objectContaining({ fecha: fechaIso(0), q: 'Cliente 23', page: 0, size: 10 }),
    )
  })

  test('el historial abierto no se cierra al cambiar de página', async () => {
    const user = userEvent.setup()
    servir(Array.from({ length: 24 }, (_, i) => pedidoSeg(i + 1)))
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')
    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 2' }))
    await screen.findByRole('complementary', { name: 'Historial del pedido 2' })

    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    await screen.findByText('Mostrando 11 a 20 de 24')

    expect(screen.getByRole('complementary', { name: 'Historial del pedido 2' })).toBeInTheDocument()
  })

  test('cambiar la fecha vuelve a la página 1', async () => {
    const user = userEvent.setup()
    servir(Array.from({ length: 24 }, (_, i) => pedidoSeg(i + 1)))
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))

    await user.click(screen.getByRole('button', { name: 'Mañana' }))

    expect(await screen.findByText('Mostrando 1 a 10 de 24')).toBeInTheDocument()
  })
})

describe('SeguimientoPage: pastillas de estado como filtro', () => {
  const pastilla = (nombre) => within(screen.getByRole('list', { name: 'Filtrar por estado' })).getByRole('button', { name: nombre })

  test('empiezan con Todos activo y muestran el total', async () => {
    await dibujar()

    expect(pastilla(/^Todos 3$/)).toHaveAttribute('aria-pressed', 'true')
    expect(pastilla(/^Pendiente 1$/)).toHaveAttribute('aria-pressed', 'false')
    expect(idsSeg()).toEqual([1, 2, 3])
  })

  test('al hacer clic en un estado la tabla muestra solo esos pedidos', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(pastilla(/^En camino 1$/))

    expect(idsSeg()).toEqual([1])
    expect(pastilla(/^En camino 1$/)).toHaveAttribute('aria-pressed', 'true')
    expect(pastilla(/^Todos 3$/)).toHaveAttribute('aria-pressed', 'false')
  })

  test('Todos quita el filtro y un segundo clic en la misma pastilla también', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(pastilla(/^Entregado 1$/))
    expect(idsSeg()).toEqual([3])
    await user.click(pastilla(/^Todos 3$/))
    expect(idsSeg()).toEqual([1, 2, 3])

    await user.click(pastilla(/^Pendiente 1$/))
    await user.click(pastilla(/^Pendiente 1$/))
    expect(idsSeg()).toEqual([1, 2, 3])
  })

  test('un estado sin pedidos deja la tabla vacía con su mensaje', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(pastilla(/^Asignado 0$/))

    expect(screen.getByText('No hay pedidos para esta fecha.')).toBeInTheDocument()
  })

  test('el filtro de estado se combina con el buscador y las pastillas siguen contando todo el día', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(pastilla(/^Pendiente 1$/))
    await user.type(screen.getByRole('searchbox'), 'maria')

    expect(await screen.findByText('No hay pedidos para esta fecha.')).toBeInTheDocument()
    expect(listarPedidos).toHaveBeenCalledWith(expect.objectContaining({ estado: 'PENDIENTE', q: 'maria' }))
    expect(pastilla(/^Todos 3$/)).toBeInTheDocument()
  })

  test('filtrar por estado vuelve a la página 1', async () => {
    const user = userEvent.setup()
    servir(Array.from({ length: 24 }, (_, i) => pedidoSeg(i + 1)))
    render(<SeguimientoPage />)
    await screen.findByText('Cliente 01')
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))

    await user.click(pastilla(/^Pendiente 24$/))

    expect(screen.getByText('Mostrando 1 a 10 de 24')).toBeInTheDocument()
  })

  test('una actualización en tiempo real mueve el pedido a su nueva pastilla sin perder el filtro', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(pastilla(/^En camino 1$/))
    await waitFor(() => expect(idsSeg()).toEqual([1]))
    servir(backend.map((pedido) => (pedido.id === 1 ? { ...pedido, estado: 'ENTREGADO' } : pedido))) // lo que ya sabe el backend

    act(() => mockRecibirCambio(cambio(1, 'ENTREGADO')))

    await waitFor(() => expect(screen.queryByText('Maria Torres')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: /^Entregado 2$/ })).toBeInTheDocument()
    expect(pastilla(/^En camino 0$/)).toHaveAttribute('aria-pressed', 'true')
  })

  test('el historial abierto sigue visible aunque el filtro oculte la fila', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Ver historial del pedido 1' }))
    await screen.findByText('2026-03-01 18:00:00')

    await user.click(pastilla(/^Pendiente 1$/))

    expect(screen.getByRole('complementary', { name: 'Historial del pedido 1' })).toBeInTheDocument()
  })
})
