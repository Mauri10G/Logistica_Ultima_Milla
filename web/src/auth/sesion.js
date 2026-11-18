// Sesión del usuario (token, rol y vencimiento) guardada en localStorage. Sin dependencias de React ni de la API.
const CLAVE = 'logistica.sesion'
const MAXIMO_TEMPORIZADOR_MS = 2 ** 31 - 1 // setTimeout no admite más; se reprograma si falta más tiempo
const oyentes = new Set()
let temporizador = null
let aviso = null

export const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró, ingresa de nuevo'

function avisar() {
  const sesion = obtenerSesion()
  oyentes.forEach((oyente) => oyente(sesion))
}

function leer() {
  try {
    const texto = localStorage.getItem(CLAVE)
    return texto ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

function vencida(sesion) {
  return Boolean(sesion?.expiraEn) && Date.parse(sesion.expiraEn) <= Date.now()
}

/**
 * @returns {{ token: string, rol: string, repartidorId: number|null, expiraEn: string|null } | null}
 *   null si no hay sesión o si ya venció (en ese caso se borra y queda el aviso de sesión expirada).
 */
export function obtenerSesion() {
  const sesion = leer()
  if (vencida(sesion)) {
    try {
      localStorage.removeItem(CLAVE)
    } catch {
      // sin almacenamiento: la sesión igual se considera cerrada
    }
    aviso = MENSAJE_SESION_EXPIRADA
    return null
  }
  return sesion
}

export function obtenerToken() {
  return obtenerSesion()?.token ?? null
}

/** Aviso para la pantalla de login tras una sesión que terminó sola (vencida o rechazada por el backend); null si no hubo. */
export function obtenerAvisoSesion() {
  return aviso
}

/** Programa el cierre automático para el instante `expiraEn` de la sesión guardada (una sola vez, sin duplicar). */
export function vigilarExpiracion() {
  clearTimeout(temporizador)
  temporizador = null
  const sesion = leer()
  if (!sesion?.expiraEn) return
  const falta = Date.parse(sesion.expiraEn) - Date.now()
  if (Number.isNaN(falta)) return
  temporizador = setTimeout(() => {
    if (vencida(leer())) expirarSesion()
    else vigilarExpiracion()
  }, Math.min(Math.max(falta, 0), MAXIMO_TEMPORIZADOR_MS))
}

export function guardarSesion({ token, rol, repartidorId = null, expiraEn = null }) {
  aviso = null
  localStorage.setItem(CLAVE, JSON.stringify({ token, rol, repartidorId, expiraEn }))
  vigilarExpiracion()
  avisar()
}

/** Cierre voluntario (botón "Cerrar sesión"): sin aviso. */
export function cerrarSesion() {
  clearTimeout(temporizador)
  temporizador = null
  localStorage.removeItem(CLAVE)
  avisar()
}

/** La sesión terminó sola (el token venció o el backend lo rechazó con 401): se cierra y el login muestra el aviso. */
export function expirarSesion() {
  if (leer()) aviso = MENSAJE_SESION_EXPIRADA // sin sesión no hay nada que avisar (p. ej. dos 401 seguidos)
  cerrarSesion()
}

/** Notifica cada cambio de sesión (login, logout o expiración). Devuelve la función para cancelar. */
export function alCambiarSesion(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}
