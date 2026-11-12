import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const PRIMER_CAMPO =
  'input:not([readonly]):not([disabled]):not([type="hidden"]):not([type="checkbox"]), select:not([disabled]), textarea:not([disabled])'

/**
 * Ventana modal centrada sobre la página. Se muestra mientras el componente esté montado
 * (el padre decide cuándo: `{abierto && <Modal ...>}`).
 *
 * - role="dialog" y aria-modal, con el título como nombre accesible.
 * - El foco pasa al primer campo al abrir, queda atrapado dentro con Tab y vuelve al elemento
 *   que la abrió al cerrar (sin mover el scroll, para no perder la posición de la lista).
 * - Esc llama a `onCerrar`. No se cierra al hacer clic fuera, para no perder lo escrito.
 * - La página de fondo no se desplaza; si el contenido no entra, el modal tiene scroll interno.
 */
export default function Modal({ titulo, onCerrar, children }) {
  const idTitulo = useId()
  const dialogoRef = useRef(null)
  const onCerrarRef = useRef(onCerrar)

  useEffect(() => {
    onCerrarRef.current = onCerrar
  })

  useEffect(() => {
    const dialogo = dialogoRef.current
    const elementoPrevio = document.activeElement
    const { overflow, paddingRight } = document.body.style

    // Bloquea el scroll de la página sin que el contenido "salte" al desaparecer la barra.
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (anchoBarra > 0) {
      document.body.style.paddingRight = `${anchoBarra}px`
    }

    const primerFocalizable = dialogo.querySelector(PRIMER_CAMPO) ?? dialogo
    primerFocalizable.focus({ preventScroll: true })

    function alPulsarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        onCerrarRef.current()
        return
      }
      if (evento.key !== 'Tab') return
      const focalizables = [...dialogo.querySelectorAll(FOCALIZABLES)]
      if (focalizables.length === 0) {
        evento.preventDefault()
        return
      }
      const primero = focalizables[0]
      const ultimo = focalizables.at(-1)
      const dentro = dialogo.contains(document.activeElement)
      if (evento.shiftKey && (document.activeElement === primero || !dentro)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !dentro)) {
        evento.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alPulsarTecla)

    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      if (elementoPrevio?.isConnected) elementoPrevio.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="modal-fondo">
      <div ref={dialogoRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <h2 id={idTitulo} className="modal-titulo">
          {titulo}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
