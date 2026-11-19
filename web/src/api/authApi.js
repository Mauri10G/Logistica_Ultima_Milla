import { api } from './client'

/**
 * POST /api/auth/login  cuerpo { usuario, clave }  respuesta { token, rol, repartidorId, expiraEn }
 * rol es STAFF (personal del negocio, usa la web) o COURIER (repartidor, usa la app móvil);
 * expiraEn es el instante (UTC, ISO-8601) en que vence el token. Contrato: docs/api-auth.md.
 * Está aislada aquí para ajustarla fácilmente si el contrato cambia.
 */
export async function iniciarSesionApi(usuario, clave) {
  const respuesta = await api.post('/auth/login', { usuario, clave })
  const { token, rol, repartidorId, expiraEn } = respuesta.data
  return { token, rol, repartidorId: repartidorId ?? null, expiraEn: expiraEn ?? null }
}
