import { useId } from 'react'

/**
 * Interruptor accesible (un checkbox con role="switch"): se activa con clic, Espacio o Enter y lo anuncian como
 * "interruptor activado / desactivado". La etiqueta es visible; `descripcion` suma contexto al nombre accesible
 * (p. ej. "de Ana Pérez" en el interruptor de una fila de repartidores) sin cambiar el texto que se ve.
 */
export default function Interruptor({ etiqueta, descripcion, activo, onCambiar, disabled = false }) {
  const idEtiqueta = useId()
  const idDescripcion = useId()
  return (
    <label className="interruptor">
      <input
        type="checkbox"
        role="switch"
        checked={activo}
        disabled={disabled}
        aria-labelledby={descripcion ? `${idEtiqueta} ${idDescripcion}` : idEtiqueta}
        onChange={(e) => onCambiar(e.target.checked)}
      />
      <span className="interruptor-pista" aria-hidden="true" />
      <span id={idEtiqueta} className="interruptor-texto">
        {etiqueta}
      </span>
      {descripcion && (
        <span id={idDescripcion} className="solo-lectores">
          {descripcion}
        </span>
      )}
    </label>
  )
}
