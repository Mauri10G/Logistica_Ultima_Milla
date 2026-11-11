import { api } from './client'

export async function listarRutas(fecha) {
  const respuesta = await api.get('/rutas', { params: { fecha } })
  return respuesta.data
}

/** Dispara el armado de rutas para una fecha de entrega (YYYY-MM-DD). */
export async function armarRutas(fecha) {
  const respuesta = await api.post('/rutas/armar', null, { params: { fecha } })
  return respuesta.data
}

// --- Ajustes manuales (contrato acordado con Joseph; cada función se puede cambiar sin tocar la pantalla) ---
// Todas publican en /topic/rutas, por eso RutasPage se recarga sola.

/** PATCH /api/rutas/{id}/repartidor  cuerpo { repartidorId } */
export async function cambiarRepartidorDeRuta(rutaId, repartidorId) {
  const respuesta = await api.patch(`/rutas/${rutaId}/repartidor`, { repartidorId })
  return respuesta.data
}

/** POST /api/rutas/{id}/pedidos/{pedidoId}  mueve el pedido a la ruta indicada (409 si está llena). */
export async function moverPedidoARuta(rutaId, pedidoId) {
  const respuesta = await api.post(`/rutas/${rutaId}/pedidos/${pedidoId}`)
  return respuesta.data
}

/** DELETE /api/rutas/{id}/pedidos/{pedidoId}  saca el pedido de la ruta y vuelve a PENDIENTE. */
export async function sacarPedidoDeRuta(rutaId, pedidoId) {
  const respuesta = await api.delete(`/rutas/${rutaId}/pedidos/${pedidoId}`)
  return respuesta.data
}

/** PUT /api/rutas/{id}/orden  cuerpo { pedidos: [ids en el nuevo orden de visita] } */
export async function reordenarRuta(rutaId, pedidosIds) {
  const respuesta = await api.put(`/rutas/${rutaId}/orden`, { pedidos: pedidosIds })
  return respuesta.data
}
