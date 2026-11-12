import { useEffect, useRef } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

export const DURACION_OK_MS = 5000
export const DURACION_ERROR_MS = 9000

function Aviso({ tipo, mensaje, onCerrar, duracion }) {
  const onCerrarRef = useRef(onCerrar)

  useEffect(() => {
    onCerrarRef.current = onCerrar
  })

  // Se reprograma solo si cambia el mensaje (onCerrar es una función nueva en cada render de la pantalla).
  useEffect(() => {
    if (!mensaje) return undefined
    const temporizador = setTimeout(() => onCerrarRef.current(), duracion)
    return () => clearTimeout(temporizador)
  }, [mensaje, duracion])

  if (!mensaje) return null
  const error = tipo === 'error'
  const Icono = error ? CircleAlert : CircleCheck
  return (
    <div className={`aviso aviso-${tipo}`} role={error ? 'alert' : 'status'}>
      <Icono className="aviso-icono" size={20} aria-hidden="true" />
      <span className="aviso-texto">{mensaje}</span>
      <button type="button" className="aviso-cerrar" aria-label="Cerrar aviso" onClick={onCerrar}>
        <X size={16} aria-hidden="true" />
      </button>
      <span className="aviso-barra" aria-hidden="true" style={{ animationDuration: `${duracion}ms` }} />
    </div>
  )
}

/**
 * Avisos tipo toast, arriba a la derecha: uno de éxito (role="status") y uno de error (role="alert").
 * Desaparecen solos (los de error tardan más, para que dé tiempo a leerlos) o con la X.
 * Es presentacional: el estado vive en la pantalla; al cerrarse llama a `onCerrarMensaje` / `onCerrarError`.
 */
export default function Avisos({ mensaje, error, onCerrarMensaje, onCerrarError }) {
  return (
    <div className="avisos">
      <Aviso tipo="ok" mensaje={mensaje} onCerrar={onCerrarMensaje} duracion={DURACION_OK_MS} />
      <Aviso tipo="error" mensaje={error} onCerrar={onCerrarError} duracion={DURACION_ERROR_MS} />
    </div>
  )
}
