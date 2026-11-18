import { LogOut, Lock, User } from 'lucide-react'
import { cerrarSesion } from '../auth/sesion'
import FondoRutas from '../components/FondoRutas'
import Logo from '../components/Logo'
import PanelLogin from '../components/PanelLogin'

/**
 * Pantalla para quien inició sesión con un rol que no puede usar la web (p. ej. un repartidor, que usa la app móvil).
 * Mismo estilo que el login: el panel con la ilustración a la izquierda y, a la derecha, el aviso y "Cerrar sesión".
 *
 * @param {{ usuario?: string | null }} props nombre del usuario que entró
 */
export default function SinAccesoPage({ usuario = null }) {
  return (
    <main className="login-pagina">
      <PanelLogin />

      <section className="login-lado-form">
        <FondoRutas />
        <div className="login-contenido">
          <div className="login-marca-movil">
            <Logo />
            <span>Entregas y Rutas</span>
          </div>

          <div className="sin-acceso">
            <span className="sin-acceso-candado">
              <Lock size={34} aria-hidden="true" />
            </span>
            <div className="sin-acceso-texto" role="alert">
              <h1>Sin acceso</h1>
              <p>Su usuario no tiene acceso a la aplicación web. Los repartidores deben usar la aplicación móvil.</p>
            </div>
            {usuario && (
              <p className="sin-acceso-usuario">
                <User size={16} aria-hidden="true" />
                <span>
                  Sesión iniciada como <strong>{usuario}</strong>
                </span>
              </p>
            )}
            <button type="button" className="login-enviar" onClick={cerrarSesion}>
              <LogOut size={18} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>

        <p className="login-pie">Sistema de Gestión de Entregas y Rutas · UTA FISEI</p>
      </section>
    </main>
  )
}
