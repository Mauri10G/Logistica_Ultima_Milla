import { Activity, LayoutDashboard, LogOut, MapPinned, Package, Route, Truck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cerrarSesion } from '../auth/sesion'
import { useSesion } from '../auth/useSesion'
import Logo from './Logo'

const MENU = [
  { to: '/', texto: 'Inicio', icono: LayoutDashboard, exacto: true },
  { to: '/pedidos', texto: 'Pedidos', icono: Package },
  { to: '/zonas', texto: 'Zonas', icono: MapPinned },
  { to: '/rutas', texto: 'Rutas', icono: Route },
  { to: '/repartidores', texto: 'Repartidores', icono: Truck },
  { to: '/seguimiento', texto: 'Seguimiento', icono: Activity },
]

export default function Layout() {
  const { sesion, authHabilitada } = useSesion()

  return (
    <div className="layout">
      <a className="saltar-contenido" href="#contenido">
        Saltar al contenido
      </a>
      <nav className="menu-lateral" aria-label="Menú principal">
        <div className="marca">
          <Logo />
          <span className="marca-texto">
            <span className="marca-nombre">Entregas y Rutas</span>
            <span className="marca-lema">Logística de última milla</span>
          </span>
        </div>
        <ul className="menu-lista">
          {MENU.map(({ to, texto, icono: Icono, exacto }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={exacto}
                title={texto}
                className={({ isActive }) => (isActive ? 'menu-enlace activo' : 'menu-enlace')}
              >
                <Icono size={20} aria-hidden="true" />
                <span className="menu-texto">{texto}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        {authHabilitada && sesion && (
          <div className="menu-pie">
            <button type="button" className="cerrar-sesion" title="Cerrar sesión" onClick={cerrarSesion}>
              <LogOut size={20} aria-hidden="true" />
              <span className="menu-texto">Cerrar sesión</span>
            </button>
          </div>
        )}
      </nav>
      <main className="contenido" id="contenido" tabIndex={-1}>
        <div className="contenido-interno">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
