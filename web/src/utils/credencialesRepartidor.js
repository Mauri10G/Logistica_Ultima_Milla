/**
 * Reglas del usuario y la contraseña de un repartidor nuevo. Son las mismas del backend
 * (RepartidorAltaRequest): si cambian allá, cambian aquí.
 */
export const USUARIO_MIN = 3
export const USUARIO_MAX = 50
export const CLAVE_MIN = 6
export const CLAVE_MAX = 72

const FORMATO_USUARIO = /^[a-z0-9._]+$/

/** Mensaje de error del usuario, o null si es válido. Se evalúa tal cual (sin espacios sobrantes). */
export function errorDeUsuario(usuario) {
  if (!usuario) return 'El usuario es obligatorio.'
  if (usuario.length < USUARIO_MIN || usuario.length > USUARIO_MAX) {
    return `El usuario debe tener entre ${USUARIO_MIN} y ${USUARIO_MAX} caracteres.`
  }
  if (!FORMATO_USUARIO.test(usuario)) {
    return 'El usuario solo admite letras minúsculas, números, punto o guion bajo.'
  }
  return null
}

/** Mensaje de error de la contraseña, o null si es válida. */
export function errorDeClave(clave) {
  if (!clave) return 'La contraseña es obligatoria.'
  if (clave.length < CLAVE_MIN) return `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`
  if (clave.length > CLAVE_MAX) return `La contraseña admite hasta ${CLAVE_MAX} caracteres.`
  return null
}
