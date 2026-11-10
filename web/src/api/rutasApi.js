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
