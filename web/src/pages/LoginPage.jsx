import { CircleAlert, LogIn } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { iniciarSesionApi } from '../api/authApi'
import { guardarSesion } from '../auth/sesion'
import Logo from '../components/Logo'
import { ROL_STAFF, useSesion } from '../auth/useSesion'
import { estadoHttp, mensajeDeError } from '../utils/errores'

export const MENSAJE_CREDENCIALES = 'Usuario o clave incorrectos'

export default function LoginPage() {
  const { sesion, authHabilitada } = useSesion()
  const navegar = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
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
    <main className="pantalla-login">
      <form className="tarjeta formulario formulario-login" onSubmit={enviar} aria-label="Iniciar sesión">
        <div className="login-marca ancho-completo">
          <Logo />
          <div>
            <h1>Entregas y Rutas</h1>
            <p>Ingrese con su usuario de personal.</p>
          </div>
        </div>
        <div className="campo ancho-completo">
          <label htmlFor="loginUsuario">Usuario</label>
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
        <div className="campo ancho-completo">
          <label htmlFor="loginClave">Clave</label>
          <input
            id="loginClave"
            name="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'errorLogin' : undefined}
            required
          />
        </div>
        {error && (
          <p id="errorLogin" className="mensaje-error mensaje-con-icono ancho-completo" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
        <div className="acciones ancho-completo">
          <button type="submit" disabled={enviando}>
            <LogIn size={18} aria-hidden="true" />
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </form>
    </main>
  )
}
