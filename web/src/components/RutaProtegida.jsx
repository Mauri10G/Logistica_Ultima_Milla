import { Navigate, Outlet } from 'react-router-dom'
import { cerrarSesion } from '../auth/sesion'
import { ROL_STAFF, useSesion } from '../auth/useSesion'

/**
 * Protege las pantallas de la web. Con login deshabilitado deja pasar siempre; con login habilitado exige
 * sesión (si no hay, va a /login) y rol STAFF (un COURIER usa la app móvil, no esta web).
 */
export default function RutaProtegida() {
  const { sesion, authHabilitada } = useSesion()

  if (!authHabilitada) return <Outlet />
  if (!sesion) return <Navigate to="/login" replace />
  if (sesion.rol !== ROL_STAFF) {
    return (
      <main className="pantalla-login">
        <div className="tarjeta" role="alert">
          <h1>Sin acceso</h1>
          <p>Su usuario no tiene acceso a la aplicación web. Los repartidores deben usar la aplicación móvil.</p>
          <button type="button" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </main>
    )
  }
  return <Outlet />
}
