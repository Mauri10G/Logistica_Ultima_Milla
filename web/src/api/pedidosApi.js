import { api } from './client'

/** @returns {Promise<{ pedidos: object[], total: number }>} (el total viene en la cabecera X-Total-Count) */
export async function listarPedidos({ fecha, zonaId, estado, page = 0, size = 100 } = {}) {
  const params = { page, size }
  if (fecha) params.fecha = fecha
  if (zonaId) params.zonaId = zonaId
  if (estado) params.estado = estado
  const respuesta = await api.get('/pedidos', { params })
  return {
    pedidos: respuesta.data,
    total: Number(respuesta.headers['x-total-count'] ?? respuesta.data.length),
  }
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

/** Elimina un pedido PENDIENTE (409 si ya no lo es). */
export async function eliminarPedido(id) {
  await api.delete(`/pedidos/${id}`)
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
