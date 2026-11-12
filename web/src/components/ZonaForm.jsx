import { Check, Eraser, Save, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { poligonoAPuntos, puntosAPoligono } from '../utils/geojson'
import { buscarPuntoImantado, RADIO_IMAN_METROS } from '../utils/iman'
import EditorPoligono from './EditorPoligono'

export const MENSAJE_POCOS_PUNTOS = 'Dibuje al menos 3 puntos en el mapa'
export const MENSAJE_SIN_CERRAR = 'Cierre el polígono antes de guardar'
export const MINIMO_PUNTOS = 3

/** Texto de "Guardar" según el estado del formulario. */
function textoBoton(guardando, editando) {
  if (guardando) return 'Guardando…'
  return editando ? 'Guardar cambios' : 'Guardar zona'
}

/** Aviso de que un punto quedó pegado a un vértice o a un borde; null si no hubo imán. */
function avisoDeIman(iman) {
  if (!iman) return null
  const destino = iman.tipo === 'vertice' ? 'a un vértice' : 'al borde'
  return `Punto pegado ${destino} de la zona «${iman.zona}».`
}

/**
 * Formulario de zona (alta y edición). El polígono se dibuja con clics en el mapa; botones Deshacer punto,
 * Cerrar polígono y Limpiar. Es presentacional: entrega { nombre, area, activa } a `onGuardar`.
 *
 * @param {object} [zona] si viene, se edita esa zona y su polígono se carga en el mapa (CP-07)
 * @param {object[]} [zonasReferencia] las demás zonas activas, como referencia en el mapa y para el efecto imán:
 *   un clic a menos de RADIO_IMAN_METROS de un vértice (prioridad) o de un borde de ellas se pega ahí
 *   (zonas contiguas, sin huecos)
 * @param {string|null} [advertencia] mensaje de ZONA_SUPERPUESTA; muestra "Guardar de todas formas" (CP-08)
 * @param {() => void} [onEditar] se llama cuando el usuario cambia algo (para limpiar avisos anteriores)
 * @param {(zona: object, momento: 'desmarcar'|'guardar') => Promise<boolean>} [onConfirmarDesactivar] se llama antes de
 *   desactivar una zona activa, al desmarcar "Zona activa" y otra vez al guardar; si da false no se desactiva
 * @param {(advertencia: string) => Promise<boolean>} [onConfirmarSuperposicion] se llama antes de
 *   "Guardar de todas formas"; si da false no se guarda
 */
export default function ZonaForm({
  zona = null,
  zonasReferencia = [],
  onGuardar,
  onCancelar,
  onEditar,
  onConfirmarDesactivar,
  onConfirmarSuperposicion,
  guardando = false,
  error = null,
  advertencia = null,
}) {
  const [nombre, setNombre] = useState(zona?.nombre ?? '')
  const [activa, setActiva] = useState(zona?.activa ?? true)
  const [puntos, setPuntos] = useState(() => (zona ? poligonoAPuntos(zona.area) : []))
  const [cerrado, setCerrado] = useState(zona !== null)
  const [errorLocal, setErrorLocal] = useState(null)
  const [avisoIman, setAvisoIman] = useState(null)
  const editando = zona !== null

  function modificado() {
    setErrorLocal(null)
    onEditar?.()
  }

  function agregarPunto(latitud, longitud) {
    const iman = buscarPuntoImantado(latitud, longitud, zonasReferencia)
    // pegado: el vértice exacto o el punto del borde de la otra zona (sin redondear); si no, el clic a 6 decimales
    const punto = iman ? iman.punto : [Number(latitud.toFixed(6)), Number(longitud.toFixed(6))]
    setPuntos((anteriores) => [...anteriores, punto])
    setAvisoIman(avisoDeIman(iman))
    modificado()
  }

  function deshacer() {
    setPuntos((anteriores) => anteriores.slice(0, -1))
    setAvisoIman(null)
    setCerrado(false)
    modificado()
  }

  function cerrar() {
    if (puntos.length < MINIMO_PUNTOS) {
      setErrorLocal(MENSAJE_POCOS_PUNTOS)
      return
    }
    setCerrado(true)
    setAvisoIman(null)
    modificado()
  }

  function limpiar() {
    setPuntos([])
    setAvisoIman(null)
    setCerrado(false)
    modificado()
  }

  function validar() {
    if (puntos.length < MINIMO_PUNTOS) return MENSAJE_POCOS_PUNTOS
    if (!cerrado) return MENSAJE_SIN_CERRAR
    return null
  }

  function construirDatos() {
    return { nombre: nombre.trim(), area: puntosAPoligono(puntos), activa }
  }

  /** Desactivar una zona activa pide confirmación; false si la persona canceló. */
  async function confirmarDesactivacion(momento) {
    const desactiva = editando && zona.activa && !activa
    return !desactiva || !onConfirmarDesactivar || (await onConfirmarDesactivar(zona, momento))
  }

  async function cambiarActiva(marcada) {
    if (!marcada && editando && zona.activa && onConfirmarDesactivar && !(await onConfirmarDesactivar(zona, 'desmarcar'))) {
      return // sigue activa
    }
    setActiva(marcada)
  }

  async function enviar(evento) {
    evento.preventDefault()
    const problema = validar()
    setErrorLocal(problema)
    if (problema) return
    if (!(await confirmarDesactivacion('guardar'))) return
    onGuardar(construirDatos(), false)
  }

  async function guardarDeTodasFormas() {
    if (onConfirmarSuperposicion && !(await onConfirmarSuperposicion(advertencia))) return
    onGuardar(construirDatos(), true)
  }

  return (
    <form className="formulario" onSubmit={enviar} aria-label={editando ? 'Editar zona' : 'Nueva zona'}>
      <h3 className="ancho-completo modal-titulo">{editando ? `Editar zona ${zona.nombre}` : 'Nueva zona'}</h3>
      <div className="grupo-form ancho-completo">
        <h4 className="grupo-titulo">Datos de la zona</h4>
        <div className="campo">
          <label htmlFor="zonaNombre">Nombre de la zona</label>
          <input
            id="zonaNombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              modificado()
            }}
            aria-describedby="ayudaZonaNombre"
            required
          />
          <p id="ayudaZonaNombre" className="ayuda">
            Debe ser distinto al de las demás zonas.
          </p>
        </div>
        <div className="campo campo-check">
          <input id="zonaActiva" type="checkbox" checked={activa} onChange={(e) => cambiarActiva(e.target.checked)} />
          <label htmlFor="zonaActiva">Zona activa</label>
        </div>
      </div>

      <div className="grupo-form ancho-completo">
        <h4 className="grupo-titulo">
          <span>Límites en el mapa</span>
          <span className="grupo-descripcion">Dibuje el polígono punto por punto y ciérrelo.</span>
        </h4>
        <div className="ancho-completo">
          <EditorPoligono puntos={puntos} cerrado={cerrado} onAgregar={agregarPunto} zonasReferencia={zonasReferencia} />
          <output className="ayuda">
            {cerrado
              ? `Polígono cerrado con ${puntos.length} puntos.`
              : `Haga clic en el mapa para agregar puntos (${puntos.length} agregado(s), mínimo ${MINIMO_PUNTOS}).`}
          </output>
          {!cerrado && zonasReferencia.length > 0 && (
            <p className="ayuda">
              Para que dos zonas queden pegadas, haga clic a menos de {RADIO_IMAN_METROS} m de otra zona: el punto se
              pega solo al vértice más cercano o, si no hay, al borde. Un círculo verde en el mapa muestra dónde se
              pegará.
            </p>
          )}
          {avisoIman && (
            <output className="ayuda aviso-iman">{avisoIman}</output>
          )}
          <div className="acciones-mapa">
            <button type="button" className="secundario pequeno" onClick={deshacer} disabled={puntos.length === 0}>
              <Undo2 size={16} aria-hidden="true" />
              Deshacer punto
            </button>
            <button
              type="button"
              className="secundario pequeno"
              onClick={cerrar}
              disabled={cerrado || puntos.length === 0}
            >
              <Check size={16} aria-hidden="true" />
              Cerrar polígono
            </button>
            <button type="button" className="secundario pequeno" onClick={limpiar} disabled={puntos.length === 0}>
              <Eraser size={16} aria-hidden="true" />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {errorLocal && (
        <p className="mensaje-error ancho-completo" role="alert">
          {errorLocal}
        </p>
      )}
      {error && (
        <p className="mensaje-error ancho-completo" role="alert">
          {error}
        </p>
      )}
      {advertencia && (
        <div className="mensaje-advertencia ancho-completo" role="alert">
          <p>
            <strong>Advertencia:</strong> {advertencia}
          </p>
          <p>
            Para que queden pegadas sin cruzarse, dibuje los puntos del borde común cerca de la zona vecina: se pegan
            solos a sus vértices o a su borde. Se tolera una superposición mínima por diferencias de decimales.
          </p>
          <button type="button" className="advertencia" onClick={guardarDeTodasFormas} disabled={guardando}>
            Guardar de todas formas
          </button>
        </div>
      )}

      <div className="acciones ancho-completo">
        {onCancelar && (
          <button type="button" className="secundario" onClick={onCancelar}>
            {editando ? 'Cancelar edición' : 'Cancelar'}
          </button>
        )}
        <button type="submit" disabled={guardando}>
          <Save size={18} aria-hidden="true" />
          {textoBoton(guardando, editando)}
        </button>
      </div>
    </form>
  )
}
