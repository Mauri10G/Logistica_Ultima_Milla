import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listarPedidos } from '../api/pedidosApi'
import { mensajeDeError } from '../utils/errores'
import { useRetraso } from './useRetraso'
import { useTabla } from './useTabla'

const SIN_EXCLUIDOS = new Set()

/** Espera tras la última tecla antes de buscar en el backend, para no pedir una página por cada letra. */
export const RETRASO_BUSQUEDA_MS = 300

/** Orden con que arrancan las tablas de pedidos: por # de menor a mayor, pedido al backend. */
export const ORDEN_INICIAL = { clave: 'id', direccion: 'asc' }

/** Columna de la tabla → columna que entiende `sort` en GET /api/pedidos (id, cliente, direccion, zona, fechaEntrega, fechaRegistro, estado). */
const COLUMNA_EN_BACKEND = {
  id: 'id',
  cliente: 'cliente',
  direccion: 'direccion',
  zona: 'zona',
  entrega: 'fechaEntrega',
  hora: 'fechaEntrega',
  registro: 'fechaRegistro',
  estado: 'estado',
}

/** Valor del parámetro `sort` para el orden de la tabla ("cliente,asc"), o undefined si la columna no la ordena el backend. */
export function ordenParaBackend(orden) {
  const columna = orden && COLUMNA_EN_BACKEND[orden.clave]
  return columna ? `${columna},${orden.direccion}` : undefined
}

/**
 * Tabla de pedidos paginada, buscada y ordenada por el backend: cada cambio de página, tamaño, orden, búsqueda o filtro
 * es una petición `GET /api/pedidos?page=&size=&sort=&q=&fecha=&zonaId=&estado=` que devuelve solo las filas de la página
 * y el total en X-Total-Count. Nada se filtra ni se ordena en el navegador.
 *
 * @param {object} opciones
 * @param {{ fecha?: string, zonaId?: string | number, estado?: string }} opciones.filtros filtros para el backend (objeto estable: cambia solo al filtrar)
 * @param {string} [opciones.busqueda] texto a buscar en cliente y dirección (el backend ignora mayúsculas y tildes)
 * @param {Set<number>} [opciones.excluir] ids que no se muestran (p. ej. eliminados a la espera del "Deshacer")
 */
export function usePedidosTabla({ filtros, busqueda = '', excluir = SIN_EXCLUIDOS }) {
  const [pedidos, setPedidos] = useState([])
  const [totalServidor, setTotalServidor] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const ultimaConsulta = useRef(0)

  const texto = useRetraso(busqueda.trim(), RETRASO_BUSQUEDA_MS)
  const visibles = useMemo(() => pedidos.filter((pedido) => !excluir.has(pedido.id)), [pedidos, excluir])
  const totalVisible = totalServidor - (pedidos.length - visibles.length)

  const tabla = useTabla(visibles, {
    ordenInicial: ORDEN_INICIAL,
    reiniciarCon: [filtros, texto],
    remoto: { total: totalVisible },
  })

  const { pagina, tamano, orden } = tabla
  const sort = ordenParaBackend(orden)

  const recargar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current // una respuesta tardía de una consulta anterior no pisa a la última
    try {
      const resultado = await listarPedidos({ ...filtros, q: texto, sort, page: pagina - 1, size: tamano })
      if (consulta !== ultimaConsulta.current) return
      setPedidos(resultado.pedidos)
      setTotalServidor(resultado.total)
      setError(null)
    } catch (e) {
      if (consulta === ultimaConsulta.current) setError(mensajeDeError(e))
    } finally {
      if (consulta === ultimaConsulta.current) setCargando(false)
    }
  }, [filtros, texto, sort, pagina, tamano])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { tabla, pedidos, setPedidos, cargando, error, setError, recargar }
}
