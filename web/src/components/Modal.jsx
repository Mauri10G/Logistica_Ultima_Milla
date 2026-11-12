import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const PRIMER_CAMPO =
  'input:not([readonly]):not([disabled]):not([type="hidden"]):not([type="checkbox"]), select:not([disabled]), textarea:not([disabled])'

// Modales abiertos, del más antiguo al más nuevo. Solo el último atiende Esc y Tab: así un diálogo de confirmación
// abierto sobre un formulario no cierra también el formulario con la misma pulsación de Esc.
const pilaDeModales = []

// El scroll de la página se bloquea con el primer modal y se libera con el último en cerrarse, en el orden que sea
// (si dos modales se cierran en el mismo momento, el orden de limpieza de React no debe dejar la página bloqueada).
const bloqueoDeScroll = { cuenta: 0, overflow: '', paddingRight: '' }

function bloquearScroll() {
  if (bloqueoDeScroll.cuenta === 0) {
    const { overflow, paddingRight } = document.body.style
    Object.assign(bloqueoDeScroll, { overflow, paddingRight })
    // sin que el contenido "salte" al desaparecer la barra
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (anchoBarra > 0) document.body.style.paddingRight = `${anchoBarra}px`
  }
  bloqueoDeScroll.cuenta += 1
}

function liberarScroll() {
  bloqueoDeScroll.cuenta -= 1
  if (bloqueoDeScroll.cuenta === 0) {
    document.body.style.overflow = bloqueoDeScroll.overflow
    document.body.style.paddingRight = bloqueoDeScroll.paddingRight
  }
}

/**
 * Ventana modal centrada sobre la página. Se muestra mientras el componente esté montado
 * (el padre decide cuándo: `{abierto && <Modal ...>}`).
 *
 * - role="dialog" (o "alertdialog" para confirmaciones) y aria-modal, con el título como nombre accesible y, si se
 *   pasa `idDescripcion`, ese elemento como descripción.
 * - El foco pasa al primer campo al abrir (o al elemento de `foco`), queda atrapado dentro con Tab y vuelve al
 *   elemento que la abrió al cerrar (sin mover el scroll, para no perder la posición de la lista).
 * - Esc llama a `onCerrar`. No se cierra al hacer clic fuera, para no perder lo escrito.
 * - La página de fondo no se desplaza; si el contenido no entra, el modal tiene scroll interno.
 * - Los modales se pueden apilar: solo el de encima responde al teclado.
 *
 * @param {'dialog'|'alertdialog'} [rol]
 * @param {string} [idDescripcion] id del elemento que describe el diálogo (aria-describedby)
 * @param {{ current: HTMLElement | null }} [foco] elemento que recibe el foco al abrir, en vez del primer campo
 * @param {string} [clase] clase extra para el diálogo (p. ej. un ancho menor)
 */
export default function Modal({ titulo, onCerrar, children, rol = 'dialog', idDescripcion, foco, clase }) {
  const idTitulo = useId()
  const dialogoRef = useRef(null)
  const onCerrarRef = useRef(onCerrar)
  const focoRef = useRef(foco)

  useEffect(() => {
    onCerrarRef.current = onCerrar
    focoRef.current = foco
  })

  useEffect(() => {
    const dialogo = dialogoRef.current
    const elementoPrevio = document.activeElement
    const turno = Symbol('modal')
    pilaDeModales.push(turno)
    bloquearScroll()

    const primerFocalizable = focoRef.current?.current ?? dialogo.querySelector(PRIMER_CAMPO) ?? dialogo
    primerFocalizable.focus({ preventScroll: true })

    function alPulsarTecla(evento) {
      if (pilaDeModales.at(-1) !== turno) return
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
      pilaDeModales.splice(pilaDeModales.indexOf(turno), 1)
      liberarScroll()
      if (elementoPrevio?.isConnected) elementoPrevio.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="modal-fondo">
      <div
        ref={dialogoRef}
        className={clase ? `modal ${clase}` : 'modal'}
        role={rol}
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idDescripcion}
        tabIndex={-1}
      >
        <h2 id={idTitulo} className="modal-titulo">
          {titulo}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
