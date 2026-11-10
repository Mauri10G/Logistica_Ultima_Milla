import { NavLink, Outlet } from 'react-router-dom'

const MENU = [
  { to: '/pedidos', texto: 'Pedidos' },
  { to: '/zonas', texto: 'Zonas' },
  { to: '/rutas', texto: 'Rutas' },
  { to: '/repartidores', texto: 'Repartidores' },
  { to: '/seguimiento', texto: 'Seguimiento' },
]

export default function Layout() {
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
      </nav>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
