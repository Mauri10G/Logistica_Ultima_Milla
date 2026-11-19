import { act, renderHook, waitFor } from '@testing-library/react'
import { listarPedidos } from '../api/pedidosApi'
import { ordenParaBackend, ORDEN_INICIAL, RETRASO_BUSQUEDA_MS, usePedidosTabla } from './usePedidosTabla'
import { useRetraso } from './useRetraso'

jest.mock('../api/pedidosApi')

const FILTROS = { fecha: '2031-05-18', zonaId: '', estado: '' }
const pagina = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => ({ id: desde + i }))

beforeEach(() => {
  jest.resetAllMocks()
  listarPedidos.mockResolvedValue({ pedidos: pagina(1, 10), total: 24 })
})

afterEach(() => jest.useRealTimers())

describe('ordenParaBackend', () => {
  test.each([
    [{ clave: 'id', direccion: 'asc' }, 'id,asc'],
    [{ clave: 'cliente', direccion: 'desc' }, 'cliente,desc'],
    [{ clave: 'direccion', direccion: 'asc' }, 'direccion,asc'],
    [{ clave: 'zona', direccion: 'asc' }, 'zona,asc'],
    [{ clave: 'entrega', direccion: 'desc' }, 'fechaEntrega,desc'],
    [{ clave: 'hora', direccion: 'asc' }, 'fechaEntrega,asc'],
    [{ clave: 'registro', direccion: 'asc' }, 'fechaRegistro,asc'],
    [{ clave: 'estado', direccion: 'desc' }, 'estado,desc'],
  ])('la columna %j se pide como %s', (orden, esperado) => {
    expect(ordenParaBackend(orden)).toBe(esperado)
  })

  test('una columna que el backend no ordena (o ninguna) no manda sort', () => {
    expect(ordenParaBackend({ clave: 'ruta', direccion: 'asc' })).toBeUndefined()
    expect(ordenParaBackend({ clave: 'acciones', direccion: 'asc' })).toBeUndefined()
    expect(ordenParaBackend(null)).toBeUndefined()
  })

  test('el orden con que arrancan las tablas es por # ascendente', () => {
    expect(ORDEN_INICIAL).toEqual({ clave: 'id', direccion: 'asc' })
    expect(ordenParaBackend(ORDEN_INICIAL)).toBe('id,asc')
  })
})

describe('usePedidosTabla', () => {
  test('pide al backend la página 1 de 10 ordenada por # y publica las filas con el total del backend', async () => {
    const { result } = renderHook(() => usePedidosTabla({ filtros: FILTROS }))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(listarPedidos).toHaveBeenCalledWith({ ...FILTROS, q: '', sort: 'id,asc', page: 0, size: 10 })
    expect(result.current.tabla.filasPagina).toHaveLength(10)
    expect(result.current.tabla).toMatchObject({ total: 24, totalPaginas: 3, desde: 1, hasta: 10, enServidor: true })
  })

  test('cambiar de página, de tamaño o de orden es una petición nueva con page, size y sort', async () => {
    const { result } = renderHook(() => usePedidosTabla({ filtros: FILTROS }))
    await waitFor(() => expect(result.current.cargando).toBe(false))

    act(() => result.current.tabla.irAPagina(2))
    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10 })))

    act(() => result.current.tabla.cambiarTamano(25))
    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, size: 25 })))

    act(() => result.current.tabla.ordenarPor('cliente'))
    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'cliente,asc', page: 0 })))
  })

  test('la búsqueda espera a que el usuario deje de escribir y se manda sin espacios sobrantes', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ busqueda }) => usePedidosTabla({ filtros: FILTROS, busqueda }), {
      initialProps: { busqueda: '' },
    })
    await act(async () => {})
    listarPedidos.mockClear()

    rerender({ busqueda: ' Bol' })
    rerender({ busqueda: ' Bolívar ' })
    await act(async () => jest.advanceTimersByTime(RETRASO_BUSQUEDA_MS - 1))
    expect(listarPedidos).not.toHaveBeenCalled() // todavía está escribiendo

    await act(async () => jest.advanceTimersByTime(1))

    expect(listarPedidos).toHaveBeenCalledTimes(1)
    expect(listarPedidos).toHaveBeenCalledWith(expect.objectContaining({ q: 'Bolívar', page: 0 }))
    expect(result.current.error).toBeNull()
  })

  test('cambiar un filtro o la búsqueda vuelve a la página 1', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ filtros, busqueda }) => usePedidosTabla({ filtros, busqueda }), {
      initialProps: { filtros: FILTROS, busqueda: '' },
    })
    await act(async () => {})
    act(() => result.current.tabla.irAPagina(3))
    expect(result.current.tabla.pagina).toBe(3)

    rerender({ filtros: { ...FILTROS, estado: 'PENDIENTE' }, busqueda: '' })
    expect(result.current.tabla.pagina).toBe(1)

    act(() => result.current.tabla.irAPagina(3))
    rerender({ filtros: { ...FILTROS, estado: 'PENDIENTE' }, busqueda: 'luis' })
    await act(async () => jest.advanceTimersByTime(RETRASO_BUSQUEDA_MS))
    expect(result.current.tabla.pagina).toBe(1)
  })

  test('los pedidos excluidos (eliminados a la espera del "Deshacer") no se muestran y bajan el total', async () => {
    const excluir = new Set([2, 3])
    const { result } = renderHook(() => usePedidosTabla({ filtros: FILTROS, excluir }))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.tabla.filasPagina.map((fila) => fila.id)).not.toContain(2)
    expect(result.current.tabla.total).toBe(22)
  })

  test('si el backend falla deja el mensaje en error y deja de cargar; recargar lo limpia', async () => {
    listarPedidos.mockRejectedValueOnce({ response: { status: 500, data: { mensaje: 'Fallo del servidor' } } })
    const { result } = renderHook(() => usePedidosTabla({ filtros: FILTROS }))

    await waitFor(() => expect(result.current.error).toBe('Fallo del servidor'))
    expect(result.current.cargando).toBe(false)

    await act(async () => result.current.recargar())

    expect(result.current.error).toBeNull()
    expect(result.current.tabla.total).toBe(24)
  })

  test('una respuesta tardía de una consulta anterior no pisa a la última', async () => {
    let responderPrimera
    listarPedidos
      .mockImplementationOnce(() => new Promise((resolver) => (responderPrimera = resolver)))
      .mockResolvedValueOnce({ pedidos: [{ id: 99 }], total: 1 })
    const { result } = renderHook(() => usePedidosTabla({ filtros: FILTROS }))

    await act(async () => result.current.recargar()) // la segunda consulta responde primero
    await act(async () => responderPrimera({ pedidos: pagina(1, 10), total: 24 })) // y la primera llega tarde

    expect(result.current.pedidos).toEqual([{ id: 99 }])
    expect(result.current.tabla.total).toBe(1)
  })
})

describe('useRetraso', () => {
  test('devuelve el valor solo cuando pasa el tiempo sin cambios', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ valor }) => useRetraso(valor, 300), { initialProps: { valor: 'a' } })
    expect(result.current).toBe('a')

    rerender({ valor: 'ab' })
    act(() => jest.advanceTimersByTime(299))
    expect(result.current).toBe('a')

    rerender({ valor: 'abc' }) // otro cambio: la espera empieza de nuevo
    act(() => jest.advanceTimersByTime(299))
    expect(result.current).toBe('a')

    act(() => jest.advanceTimersByTime(1))
    expect(result.current).toBe('abc')
  })
})
