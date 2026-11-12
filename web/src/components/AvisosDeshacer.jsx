import { CircleCheck, Undo2 } from 'lucide-react'

/**
 * Avisos con botón "Deshacer" y una barra que se consume durante `duracion` ms (abajo, centrados).
 * Es presentacional: el estado y los temporizadores viven en useAccionDeshacible.
 *
 * @param {Array<{ id: number, mensaje: string }>} avisos
 * @param {number} duracion milisegundos que dura la barra
 * @param {(id: number) => void} onDeshacer
 */
export default function AvisosDeshacer({ avisos, duracion, onDeshacer }) {
  if (avisos.length === 0) return null
  return (
    <div className="avisos avisos-deshacer">
      {avisos.map((aviso) => (
        <div key={aviso.id} className="aviso aviso-ok" role="status">
          <CircleCheck className="aviso-icono" size={20} aria-hidden="true" />
          <span className="aviso-texto">{aviso.mensaje}</span>
          <button type="button" className="secundario pequeno aviso-deshacer" onClick={() => onDeshacer(aviso.id)}>
            <Undo2 size={14} aria-hidden="true" />
            Deshacer
          </button>
          <span className="aviso-barra" aria-hidden="true" style={{ animationDuration: `${duracion}ms` }} />
        </div>
      ))}
    </div>
  )
}
