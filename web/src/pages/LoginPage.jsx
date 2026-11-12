import { CircleAlert, Eye, EyeOff, LoaderCircle, Lock, LogIn, MapPinned, Radio, Route, User } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { iniciarSesionApi } from '../api/authApi'
import { guardarSesion } from '../auth/sesion'
import IlustracionLogin from '../components/IlustracionLogin'
import Logo from '../components/Logo'
import { ROL_STAFF, useSesion } from '../auth/useSesion'
import { estadoHttp, mensajeDeError } from '../utils/errores'

export const MENSAJE_CREDENCIALES = 'Usuario o clave incorrectos'

const PUNTOS = [
  { Icono: Route, texto: 'Rutas automáticas por zona y repartidor' },
  { Icono: Radio, texto: 'Seguimiento en vivo de cada pedido' },
  { Icono: MapPinned, texto: 'Zonas dibujadas directamente en el mapa' },
]

export default function LoginPage() {
  const { sesion, authHabilitada } = useSesion()
  const navegar = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  // Sin login habilitado, o con una sesión de personal ya iniciada, no hay nada que hacer aquí.
  if (!authHabilitada || sesion?.rol === ROL_STAFF) return <Navigate to="/" replace />

  async function enviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const datos = await iniciarSesionApi(usuario.trim(), clave)
      guardarSesion(datos)
      navegar('/', { replace: true })
    } catch (e) {
      setError(estadoHttp(e) === 401 ? MENSAJE_CREDENCIALES : mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login-pagina">
      <section className="login-panel">
        <IlustracionLogin />
        <div className="login-panel-texto">
          <div className="login-panel-marca">
            <Logo />
            <span>Entregas y Rutas</span>
          </div>
          <p className="login-frase">Organiza tus entregas de última milla en tiempo real</p>
          <ul className="login-puntos">
            {PUNTOS.map(({ Icono, texto }) => (
              <li key={texto}>
                <span className="login-punto-icono">
                  <Icono size={18} aria-hidden="true" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="login-lado-form">
        <div className="login-contenido">
          <div className="login-marca-movil">
            <Logo />
            <span>Entregas y Rutas</span>
          </div>

          <form className="login-formulario" onSubmit={enviar} aria-label="Iniciar sesión">
            <div className="login-bienvenida">
              <h1>Bienvenido</h1>
              <p>Ingrese con su usuario de personal</p>
            </div>

            <div className="campo">
              <label htmlFor="loginUsuario">Usuario</label>
              <div className="campo-icono">
                <User size={18} aria-hidden="true" />
                <input
                  id="loginUsuario"
                  name="usuario"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'errorLogin' : undefined}
                  required
                />
              </div>
            </div>

            <div className="campo">
              <label htmlFor="loginClave">Clave</label>
              <div className="campo-icono">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="loginClave"
                  name="clave"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'errorLogin' : undefined}
                  required
                />
                <button
                  type="button"
                  className="boton-ojo"
                  onClick={() => setVerClave((visible) => !visible)}
                  aria-label={verClave ? 'Ocultar clave' : 'Mostrar clave'}
                  aria-controls="loginClave"
                >
                  {verClave ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p id="errorLogin" className="mensaje-error mensaje-con-icono" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <button type="submit" className="login-enviar" disabled={enviando} aria-busy={enviando}>
              {enviando ? (
                <LoaderCircle className="login-girar" size={18} aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="login-pie">Sistema de Gestión de Entregas y Rutas · UTA FISEI</p>
      </section>
    </main>
  )
}
