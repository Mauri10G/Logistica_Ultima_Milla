import { api } from './client'

/**
 * POST /api/auth/login  cuerpo { usuario, clave }  respuesta { token, rol, repartidorId }
 * rol es STAFF (personal del negocio, usa la web) o COURIER (repartidor, usa la app móvil).
 * Está aislada aquí para ajustarla fácilmente si el contrato cambia.
 */
export async function iniciarSesionApi(usuario, clave) {
  const respuesta = await api.post('/auth/login', { usuario, clave })
  const { token, rol, repartidorId } = respuesta.data
  return { token, rol, repartidorId: repartidorId ?? null }
}
