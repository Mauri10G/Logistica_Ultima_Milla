import { api } from './client'

/** Línea de tiempo de estados de un pedido: [{ estadoAnterior, estadoNuevo, fechaCambio, origen }]. */
export async function obtenerHistorial(pedidoId) {
  const respuesta = await api.get(`/seguimiento/pedidos/${pedidoId}/historial`)
  return respuesta.data
}
