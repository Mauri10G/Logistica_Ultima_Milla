/**
 * Límites y formatos de los campos de texto de los formularios. Son los mismos del backend (DTO de pedido, zona y
 * repartidor, y `common/validacion/Formatos`): si cambian allá, cambian aquí.
 */
export const LIMITES = {
  clienteNombres: 150,
  clienteTelefono: 30,
  clienteEmail: 150,
  direccion: 255,
  zonaNombre: 100,
  repartidorNombres: 150,
  repartidorTelefono: 30,
}

/**
 * Teléfono: solo dígitos, espacios, guiones y un `+` inicial, empezando y terminando en dígito, con 7 a 15 dígitos
 * en total (por ejemplo 0991234567, +593 99 123 4567, 03-282-1234). Misma expresión que `Formatos.TELEFONO`.
 */
export const FORMATO_TELEFONO = /^(?=(?:\D*\d){7,15}\D*$)\+?\d[\d -]*\d$/

export const MENSAJE_TELEFONO = 'El teléfono solo admite dígitos, espacios, guiones y un + inicial, con 7 a 15 dígitos.'
export const MENSAJE_NOMBRE = 'El nombre debe contener al menos una letra.'

/** Mensaje de error del teléfono, o null si es válido. Se evalúa sin espacios sobrantes en los extremos. */
export function errorDeTelefono(telefono) {
  const valor = String(telefono ?? '').trim()
  if (!valor) return 'El teléfono es obligatorio.'
  return FORMATO_TELEFONO.test(valor) ? null : MENSAJE_TELEFONO
}

/** Mensaje de error de un nombre de persona (al menos una letra; tildes y ñ cuentan), o null si es válido. */
export function errorDeNombres(nombres) {
  const valor = String(nombres ?? '').trim()
  if (!valor) return 'El nombre es obligatorio.'
  return /\p{L}/u.test(valor) ? null : MENSAJE_NOMBRE
}

/** Longitud en bytes UTF-8 de un texto (una tilde o una ñ ocupan 2). */
export function bytesUtf8(texto) {
  return new TextEncoder().encode(texto).length
}
