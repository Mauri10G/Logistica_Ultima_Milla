import { Lock } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Candado pequeño con una explicación como tooltip. Se muestra al pasar el mouse o al enfocarlo con el teclado
 * y se cierra con Esc. El texto está siempre disponible para lectores de pantalla (aria-describedby) y el tooltip
 * visible se dibuja en el <body> con posición fija, para que la tabla (que tiene scroll) no lo recorte.
 *
 * @param {string} texto lo que explica el candado
 * @param {string} [etiqueta] nombre accesible del candado
 */
export default function CandadoAyuda({ texto, etiqueta = 'Acción bloqueada' }) {
  const idTexto = useId()
  const referencia = useRef(null)
  const [posicion, setPosicion] = useState(null)

  function mostrar() {
    const caja = referencia.current.getBoundingClientRect()
    const arriba = caja.top > 80
    setPosicion({ x: caja.left + caja.width / 2, y: arriba ? caja.top - 8 : caja.bottom + 8, arriba })
  }

  function alPulsarTecla(evento) {
    if (evento.key === 'Escape' && posicion) {
      evento.stopPropagation()
      setPosicion(null)
    }
  }

  return (
    <>
      <span
        ref={referencia}
        className="candado-ayuda"
        role="img"
        tabIndex={0}
        aria-label={etiqueta}
        aria-describedby={idTexto}
        onMouseEnter={mostrar}
        onMouseLeave={() => setPosicion(null)}
        onFocus={mostrar}
        onBlur={() => setPosicion(null)}
        onKeyDown={alPulsarTecla}
      >
        <Lock size={14} aria-hidden="true" />
      </span>
      <span id={idTexto} className="solo-lectores">
        {texto}
      </span>
      {posicion &&
        createPortal(
          <div
            className={posicion.arriba ? 'tooltip-fijo tooltip-arriba' : 'tooltip-fijo'}
            style={{ left: posicion.x, top: posicion.y }}
            aria-hidden="true"
          >
            {texto}
          </div>,
          document.body,
        )}
    </>
  )
}
