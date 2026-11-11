// Sesión del usuario (token y rol) guardada en localStorage. Sin dependencias de React ni de la API.
const CLAVE = 'logistica.sesion'
const oyentes = new Set()

function avisar() {
  const sesion = obtenerSesion()
  oyentes.forEach((oyente) => oyente(sesion))
}

/** @returns {{ token: string, rol: string, repartidorId: number|null } | null} */
export function obtenerSesion() {
  try {
    const texto = localStorage.getItem(CLAVE)
    return texto ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

export function obtenerToken() {
  return obtenerSesion()?.token ?? null
}

export function guardarSesion({ token, rol, repartidorId = null }) {
  localStorage.setItem(CLAVE, JSON.stringify({ token, rol, repartidorId }))
  avisar()
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE)
  avisar()
}

/** Notifica cada cambio de sesión (login, logout o 401). Devuelve la función para cancelar. */
export function alCambiarSesion(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}
