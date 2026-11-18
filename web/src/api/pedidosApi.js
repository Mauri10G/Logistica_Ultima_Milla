import { api } from './client'

/** Máximo de pedidos por petición que acepta el backend (pide más y lo recorta a 1000). */
export const TAMANO_LOTE = 1000

/**
 * Una página de pedidos. El backend busca (`q`: cliente o dirección, sin mayúsculas ni tildes), ordena (`sort`, con el
 * formato de Spring: "fechaEntrega,desc"; sin orden va por entrega y luego id) y pagina (`page` desde 0, `size`).
 * @returns {Promise<{ pedidos: object[], total: number }>} el total (de todas las páginas) viene en la cabecera X-Total-Count
 */
export async function listarPedidos({ fecha, zonaId, estado, q, sort, page = 0, size = 100 } = {}) {
  const params = { page, size }
  if (fecha) params.fecha = fecha
  if (zonaId) params.zonaId = zonaId
  if (estado) params.estado = estado
  if (q?.trim()) params.q = q.trim()
  if (sort) params.sort = sort
  const respuesta = await api.get('/pedidos', { params })
  return {
    pedidos: respuesta.data,
    total: Number(respuesta.headers['x-total-count'] ?? respuesta.data.length),
  }
}

/** Todos los pedidos que cumplen el filtro, pidiéndolos por lotes de 1000 (nunca se queda en la primera página). Lo usa Inicio. */
export async function listarTodosLosPedidos(filtros = {}) {
  const primero = await listarPedidos({ ...filtros, page: 0, size: TAMANO_LOTE })
  const lotes = Math.ceil(primero.total / TAMANO_LOTE)
  const restantes = await Promise.all(
    Array.from({ length: Math.max(0, lotes - 1) }, (_, i) => listarPedidos({ ...filtros, page: i + 1, size: TAMANO_LOTE })),
  )
  return { pedidos: [primero, ...restantes].flatMap((lote) => lote.pedidos), total: primero.total }
}

export async function crearPedido(datos) {
  const respuesta = await api.post('/pedidos', datos)
  return respuesta.data
}

/** Edita un pedido PENDIENTE (409 si ya no lo es: CP-05). */
export async function editarPedido(id, datos) {
  const respuesta = await api.put(`/pedidos/${id}`, datos)
  return respuesta.data
}

/**
 * Elimina un pedido PENDIENTE (409 si ya no lo es).
 * @param {{ alSalir?: boolean }} [opciones] alSalir: se pide al cerrar la pestaña; va con fetch y keepalive para que el
 *   navegador no la cancele al descargar la página.
 */
export async function eliminarPedido(id, { alSalir = false } = {}) {
  if (alSalir) {
    await api.delete(`/pedidos/${id}`, { adapter: 'fetch', fetchOptions: { keepalive: true } })
  } else {
    await api.delete(`/pedidos/${id}`)
  }
}

/**
 * Hora oficial del sistema: { fecha, hora, zonaHoraria, anticipacionMinimaMinutos, entregaMinimaFecha,
 * entregaMinimaHora }. Se usa en lugar de la hora del computador, que el usuario puede modificar.
 */
export async function obtenerHoraServidor() {
  const respuesta = await api.get('/servidor/hora')
  return respuesta.data
}

export async function cambiarEstadoPedido(id, estado, origen = 'WEB') {
  const respuesta = await api.patch(`/pedidos/${id}/estado`, { estado, origen })
  return respuesta.data
}
