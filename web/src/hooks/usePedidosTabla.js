import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listarPedidos, listarTodosLosPedidos } from '../api/pedidosApi'
import { coincide } from '../utils/busqueda'
import { mensajeDeError } from '../utils/errores'
import { useTabla } from './useTabla'

const SIN_EXCLUIDOS = new Set()

/**
 * Tabla de pedidos paginada por el backend: GET /api/pedidos?page=&size= devuelve solo la página que se muestra y el
 * total en X-Total-Count. Los filtros (fecha, zona, estado) viajan al backend. La búsqueda por cliente o dirección y el
 * orden por columna aún no existen allí: mientras se usan, el hook trae todos los pedidos del filtro (por lotes de 1000)
 * y los filtra y ordena en el navegador; al limpiar la búsqueda vuelve a pedir página por página.
 *
 * @param {object} opciones
 * @param {{ fecha?: string, zonaId?: string | number, estado?: string }} opciones.filtros filtros para el backend (objeto estable: cambia solo al filtrar)
 * @param {string} [opciones.busqueda] texto a buscar en cliente y dirección
 * @param {Record<string, (pedido: object) => string | number | null>} opciones.valores valor ordenable de cada columna
 * @param {Set<number>} [opciones.excluir] ids que no se muestran (p. ej. eliminados a la espera del "Deshacer")
 */
export function usePedidosTabla({ filtros, busqueda = '', valores, excluir = SIN_EXCLUIDOS }) {
  const [pedidos, setPedidos] = useState([])
  const [totalServidor, setTotalServidor] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const ultimaConsulta = useRef(0)

  const buscando = busqueda.trim() !== ''
  const sinExcluidos = useMemo(() => pedidos.filter((pedido) => !excluir.has(pedido.id)), [pedidos, excluir])
  const visibles = useMemo(
    () => (buscando ? sinExcluidos.filter((pedido) => coincide(busqueda, pedido.clienteNombres, pedido.direccion)) : sinExcluidos),
    [buscando, busqueda, sinExcluidos],
  )
  const totalServidorVisible = totalServidor - (pedidos.length - sinExcluidos.length)

  const tabla = useTabla(visibles, {
    valores,
    reiniciarCon: [filtros, busqueda],
    remoto: { total: totalServidorVisible, buscando },
  })

  // Solo en modo servidor la consulta depende de la página y el tamaño; en modo navegador se trae todo una vez.
  const { enServidor } = tabla
  const pagina = enServidor ? tabla.pagina : 0
  const tamano = enServidor ? tabla.tamano : 0

  const recargar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current // una respuesta tardía de una consulta anterior no pisa a la última
    try {
      const resultado = enServidor
        ? await listarPedidos({ ...filtros, page: pagina - 1, size: tamano })
        : await listarTodosLosPedidos(filtros)
      if (consulta !== ultimaConsulta.current) return
      setPedidos(resultado.pedidos)
      setTotalServidor(resultado.total)
      setError(null)
    } catch (e) {
      if (consulta === ultimaConsulta.current) setError(mensajeDeError(e))
    } finally {
      if (consulta === ultimaConsulta.current) setCargando(false)
    }
  }, [filtros, enServidor, pagina, tamano])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { tabla, pedidos, setPedidos, cargando, error, setError, recargar }
}
