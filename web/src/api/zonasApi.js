import { api } from './client'

export async function listarZonas() {
  const respuesta = await api.get('/zonas')
  return respuesta.data
}

/** @param {{ nombre: string, area: object }} datos area = GeoJSON Polygon */
export async function crearZona(datos, confirmarSuperposicion = false) {
  const respuesta = await api.post('/zonas', datos, { params: { confirmarSuperposicion } })
  return respuesta.data
}
