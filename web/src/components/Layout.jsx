import { NavLink, Outlet } from 'react-router-dom'
import { cerrarSesion } from '../auth/sesion'
import { useSesion } from '../auth/useSesion'

const MENU = [
  { to: '/pedidos', texto: 'Pedidos' },
  { to: '/zonas', texto: 'Zonas' },
  { to: '/rutas', texto: 'Rutas' },
  { to: '/repartidores', texto: 'Repartidores' },
  { to: '/seguimiento', texto: 'Seguimiento' },
]

export default function Layout() {
  const { sesion, authHabilitada } = useSesion()

  return (
    <div className="layout">
      <nav className="menu-lateral" aria-label="Menú principal">
        <h1 className="logo">Entregas y Rutas</h1>
        <ul>
          {MENU.map((opcion) => (
            <li key={opcion.to}>
              <NavLink to={opcion.to} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
                {opcion.texto}
              </NavLink>
            </li>
          ))}
        </ul>
        {authHabilitada && sesion && (
          <button type="button" className="cerrar-sesion" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        )}
      </nav>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
