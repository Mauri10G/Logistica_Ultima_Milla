import { Navigate, Outlet } from 'react-router-dom'
import { usuarioDelToken } from '../auth/sesion'
import { ROL_STAFF, useSesion } from '../auth/useSesion'
import SinAccesoPage from '../pages/SinAccesoPage'

/**
 * Protege las pantallas de la web. Con login deshabilitado deja pasar siempre; con login habilitado exige
 * sesión (si no hay, va a /login) y rol STAFF (un COURIER usa la app móvil, no esta web: ve la pantalla "Sin acceso").
 */
export default function RutaProtegida() {
  const { sesion, authHabilitada } = useSesion()

  if (!authHabilitada) return <Outlet />
  if (!sesion) return <Navigate to="/login" replace />
  if (sesion.rol !== ROL_STAFF) return <SinAccesoPage usuario={sesion.usuario ?? usuarioDelToken(sesion.token)} />
  return <Outlet />
}
