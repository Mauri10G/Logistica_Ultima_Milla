import { Info, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import Modal from './Modal'

const CLASE_BOTON = { peligro: 'peligro', advertencia: 'advertencia', normal: '' }

/**
 * Diálogo de confirmación propio (reemplaza al cuadro de confirmación del navegador). Usa el Modal del sistema con role="alertdialog".
 *
 * - El foco empieza en el botón de cancelar: Enter no ejecuta la acción por error. Esc cancela.
 * - El botón de confirmar lleva el verbo exacto de la acción ("Eliminar pedido"), no un "Aceptar" genérico.
 * - `onConfirmar` puede ser asíncrono: mientras se ejecuta el botón muestra `textoCargando`, no se puede pulsar dos
 *   veces y no se puede cancelar. El diálogo no se cierra solo: lo cierra quien lo muestra (ver useConfirmacion).
 *
 * @param {string} titulo pregunta, p. ej. "¿Eliminar el pedido 732?"
 * @param {React.ReactNode} [descripcion] qué pasa y qué se afecta
 * @param {Array<[string, string]>} [detalles] pares [etiqueta, valor] de lo afectado (cliente, dirección, fecha…)
 * @param {string} textoConfirmar verbo de la acción
 * @param {string} [textoCancelar]
 * @param {string} [textoCargando]
 * @param {'peligro'|'advertencia'|'normal'} [variante] peligro: ícono de alerta y botón rojo
 * @param {() => (void|Promise<void>)} onConfirmar
 * @param {() => void} onCancelar
 */
export default function ConfirmarDialogo({
  titulo,
  descripcion,
  detalles = [],
  textoConfirmar,
  textoCancelar = 'Cancelar',
  textoCargando = 'Procesando…',
  variante = 'peligro',
  onConfirmar,
  onCancelar,
}) {
  const idDescripcion = useId()
  const botonCancelar = useRef(null)
  const montado = useRef(true)
  const enCurso = useRef(false)
  const [ejecutando, setEjecutando] = useState(false)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  function confirmar() {
    if (enCurso.current) return // un segundo clic antes de que React pinte el estado de carga
    const resultado = onConfirmar()
    if (typeof resultado?.then !== 'function') return // acción inmediata: no hay nada que esperar
    enCurso.current = true
    setEjecutando(true)
    Promise.resolve(resultado)
      .finally(() => {
        enCurso.current = false
        if (montado.current) setEjecutando(false)
      })
      .catch(() => {}) // el error lo atiende quien dio la acción
  }

  function cancelar() {
    if (!enCurso.current) onCancelar()
  }

  const Icono = variante === 'normal' ? Info : TriangleAlert

  return (
    <Modal titulo={titulo} onCerrar={cancelar} rol="alertdialog" idDescripcion={idDescripcion} foco={botonCancelar} clase="modal-confirmar">
      <div id={idDescripcion} className="confirmar-cuerpo">
        <span className={`confirmar-icono confirmar-icono-${variante}`} aria-hidden="true">
          <Icono size={24} />
        </span>
        <div className="confirmar-texto">
          {descripcion && <p className="confirmar-descripcion">{descripcion}</p>}
          {detalles.length > 0 && (
            <dl className="confirmar-detalles">
              {detalles.map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dt>{etiqueta}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <div className="acciones">
        <button ref={botonCancelar} type="button" className="secundario" onClick={cancelar} disabled={ejecutando}>
          {textoCancelar}
        </button>
        <button type="button" className={CLASE_BOTON[variante]} onClick={confirmar} disabled={ejecutando} aria-busy={ejecutando}>
          {ejecutando && <span className="spinner spinner-boton" aria-hidden="true" />}
          {ejecutando ? textoCargando : textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}
