import { act, renderHook } from '@testing-library/react'
import { useTabla } from './useTabla'

const VALORES = { id: (fila) => fila.id }
const filas = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => ({ id: desde + i }))
const ids = (tabla) => tabla.filasPagina.map((fila) => fila.id)

describe('useTabla: modo servidor (remoto)', () => {
  test('las filas ya son la página: no se cortan y el total es el del backend', () => {
    const { result } = renderHook(() => useTabla(filas(1, 10), { valores: VALORES, remoto: { total: 24 } }))

    expect(result.current.enServidor).toBe(true)
    expect(ids(result.current)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result.current).toMatchObject({ total: 24, totalPaginas: 3, pagina: 1, tamano: 10, desde: 1, hasta: 10 })
  })

  test('la última página dice cuántas filas trae: "Mostrando 21 a 24 de 24"', () => {
    const { result, rerender } = renderHook(({ lista }) => useTabla(lista, { valores: VALORES, remoto: { total: 24 } }), {
      initialProps: { lista: filas(1, 10) },
    })

    act(() => result.current.irAPagina(3))
    rerender({ lista: filas(21, 24) })

    expect(result.current).toMatchObject({ pagina: 3, desde: 21, hasta: 24, total: 24 })
    expect(ids(result.current)).toEqual([21, 22, 23, 24])
  })

  test('cambiar el tamaño vuelve a la página 1 y recalcula las páginas con el total del backend', () => {
    const { result } = renderHook(() => useTabla(filas(1, 10), { valores: VALORES, remoto: { total: 60 } }))

    act(() => result.current.irAPagina(4))
    act(() => result.current.cambiarTamano(25))

    expect(result.current).toMatchObject({ pagina: 1, tamano: 25, totalPaginas: 3 })
  })

  test('cambiar un filtro (reiniciarCon) vuelve a la página 1', () => {
    const { result, rerender } = renderHook(
      ({ estado }) => useTabla(filas(1, 10), { valores: VALORES, reiniciarCon: [estado], remoto: { total: 60 } }),
      { initialProps: { estado: 'A' } },
    )
    act(() => result.current.irAPagina(3))
    expect(result.current.pagina).toBe(3)

    rerender({ estado: 'B' })

    expect(result.current.pagina).toBe(1)
  })

  test('si el total baja (se eliminó algo) no se queda en una página que ya no existe', () => {
    const { result, rerender } = renderHook(
      ({ total }) => useTabla(filas(1, 10), { valores: VALORES, remoto: { total } }),
      { initialProps: { total: 24 } },
    )
    act(() => result.current.irAPagina(3))

    rerender({ total: 20 })

    expect(result.current.pagina).toBe(2)
  })

  test('mientras se busca pasa al navegador: corta la página de las filas completas y no usa el total del backend', () => {
    const { result, rerender } = renderHook(
      ({ buscando, lista }) => useTabla(lista, { valores: VALORES, remoto: { total: 24, buscando } }),
      { initialProps: { buscando: false, lista: filas(1, 10) } },
    )
    expect(result.current.enServidor).toBe(true)

    rerender({ buscando: true, lista: filas(1, 15) }) // la pantalla trajo todos los que coinciden

    expect(result.current.enServidor).toBe(false)
    expect(result.current).toMatchObject({ total: 15, totalPaginas: 2, desde: 1, hasta: 10 })
    expect(ids(result.current)).toHaveLength(10)

    rerender({ buscando: false, lista: filas(1, 10) }) // se borró la búsqueda: vuelve al servidor

    expect(result.current.enServidor).toBe(true)
    expect(result.current.total).toBe(24)
  })

  test('al ordenar por una columna pasa al navegador y ordena todas las filas', () => {
    const { result, rerender } = renderHook(
      ({ lista }) => useTabla(lista, { valores: VALORES, remoto: { total: 24 } }),
      { initialProps: { lista: filas(1, 10) } },
    )

    act(() => result.current.ordenarPor('id'))
    act(() => result.current.ordenarPor('id')) // descendente
    rerender({ lista: filas(1, 24) })

    expect(result.current.enServidor).toBe(false)
    expect(result.current.total).toBe(24)
    expect(ids(result.current)).toEqual([24, 23, 22, 21, 20, 19, 18, 17, 16, 15])
  })

  test('sin la opción remoto sigue paginando en el navegador, como siempre', () => {
    const { result } = renderHook(() => useTabla(filas(1, 24), { valores: VALORES }))

    expect(result.current.enServidor).toBe(false)
    expect(result.current).toMatchObject({ total: 24, totalPaginas: 3, desde: 1, hasta: 10 })
    expect(ids(result.current)).toHaveLength(10)
  })
})
