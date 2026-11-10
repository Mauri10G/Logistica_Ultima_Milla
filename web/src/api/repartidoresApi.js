import { api } from './client'

export async function listarRepartidores() {
  const respuesta = await api.get('/repartidores')
  return respuesta.data
}

export async function crearRepartidor(datos) {
  const respuesta = await api.post('/repartidores', datos)
  return respuesta.data
}

export async function cambiarDisponibilidad(id, disponible) {
  const respuesta = await api.patch(`/repartidores/${id}/disponibilidad`, { disponible })
  return respuesta.data
}
