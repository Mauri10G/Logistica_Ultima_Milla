import { useEffect, useState } from 'react'
import { AUTH_HABILITADA } from '../entorno'
import { alCambiarSesion, obtenerSesion } from './sesion'

export const ROL_STAFF = 'STAFF'
export const ROL_COURIER = 'COURIER'

/**
 * Sesión actual (null si no hay) y si el login está habilitado (VITE_AUTH_HABILITADA).
 * Se actualiza sola cuando se inicia o cierra sesión, o cuando un 401 la invalida.
 */
export function useSesion() {
  const [sesion, setSesion] = useState(obtenerSesion)

  useEffect(() => {
    setSesion(obtenerSesion()) // por si cambió entre el render y el efecto
    return alCambiarSesion(setSesion)
  }, [])

  return { sesion, authHabilitada: AUTH_HABILITADA }
}
