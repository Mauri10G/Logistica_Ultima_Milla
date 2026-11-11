import { api } from './client'

export async function listarZonas() {
  const respuesta = await api.get('/zonas')
  return respuesta.data
}

/**
 * @param {{ nombre: string, area: object }} datos area = GeoJSON Polygon
 * @param {boolean} confirmarSuperposicion true para guardar aunque se superponga con otra zona (CP-08)
 */
export async function crearZona(datos, confirmarSuperposicion = false) {
  const respuesta = await api.post('/zonas', datos, { params: { confirmarSuperposicion } })
  return respuesta.data
}

/** Edita nombre, límites o estado de una zona (CP-07). La propia zona no cuenta como superposición. */
export async function actualizarZona(id, datos, confirmarSuperposicion = false) {
  const respuesta = await api.put(`/zonas/${id}`, datos, { params: { confirmarSuperposicion } })
  return respuesta.data
}
