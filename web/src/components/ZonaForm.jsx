import { useState } from 'react'
import { poligonoAPuntos, puntosAPoligono } from '../utils/geojson'
import EditorPoligono from './EditorPoligono'

export const MENSAJE_POCOS_PUNTOS = 'Dibuje al menos 3 puntos en el mapa'
export const MENSAJE_SIN_CERRAR = 'Cierre el polígono antes de guardar'
export const MINIMO_PUNTOS = 3

/**
 * Formulario de zona (alta y edición). El polígono se dibuja con clics en el mapa; botones Deshacer punto,
 * Cerrar polígono y Limpiar. Es presentacional: entrega { nombre, area, activa } a `onGuardar`.
 *
 * @param {object} [zona] si viene, se edita esa zona y su polígono se carga en el mapa (CP-07)
 * @param {object[]} [zonasReferencia] las demás zonas, como referencia en el mapa
 * @param {string|null} [advertencia] mensaje de ZONA_SUPERPUESTA; muestra "Guardar de todas formas" (CP-08)
 * @param {() => void} [onEditar] se llama cuando el usuario cambia algo (para limpiar avisos anteriores)
 */
export default function ZonaForm({
  zona = null,
  zonasReferencia = [],
  onGuardar,
  onCancelar,
  onEditar,
  guardando = false,
  error = null,
  advertencia = null,
}) {
  const [nombre, setNombre] = useState(zona?.nombre ?? '')
  const [activa, setActiva] = useState(zona?.activa ?? true)
  const [puntos, setPuntos] = useState(() => (zona ? poligonoAPuntos(zona.area) : []))
  const [cerrado, setCerrado] = useState(zona !== null)
  const [errorLocal, setErrorLocal] = useState(null)
  const editando = zona !== null

  function modificado() {
    setErrorLocal(null)
    onEditar?.()
  }

  function agregarPunto(latitud, longitud) {
    setPuntos((anteriores) => [...anteriores, [Number(latitud.toFixed(6)), Number(longitud.toFixed(6))]])
    modificado()
  }

  function deshacer() {
    setPuntos((anteriores) => anteriores.slice(0, -1))
    setCerrado(false)
    modificado()
  }

  function cerrar() {
    if (puntos.length < MINIMO_PUNTOS) {
      setErrorLocal(MENSAJE_POCOS_PUNTOS)
      return
    }
    setCerrado(true)
    modificado()
  }

  function limpiar() {
    setPuntos([])
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

  function enviar(evento) {
    evento.preventDefault()
    const problema = validar()
    setErrorLocal(problema)
    if (problema) return
    onGuardar(construirDatos(), false)
  }

  return (
    <form className="formulario" onSubmit={enviar} aria-label={editando ? 'Editar zona' : 'Nueva zona'}>
      <h3 className="ancho-completo">{editando ? `Editar zona ${zona.nombre}` : 'Nueva zona'}</h3>
      <div className="campo ancho-completo">
        <label htmlFor="zonaNombre">Nombre de la zona</label>
        <input
          id="zonaNombre"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            modificado()
          }}
          required
        />
      </div>
      <div className="campo ancho-completo campo-check">
        <input id="zonaActiva" type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        <label htmlFor="zonaActiva">Zona activa</label>
      </div>

      <div className="ancho-completo">
        <EditorPoligono puntos={puntos} cerrado={cerrado} onAgregar={agregarPunto} zonasReferencia={zonasReferencia} />
        <p className="ayuda" role="status">
          {cerrado
            ? `Polígono cerrado con ${puntos.length} puntos.`
            : `Haga clic en el mapa para agregar puntos (${puntos.length} agregado(s), mínimo ${MINIMO_PUNTOS}).`}
        </p>
        <div className="acciones-mapa">
          <button type="button" className="secundario" onClick={deshacer} disabled={puntos.length === 0}>
            Deshacer punto
          </button>
          <button type="button" className="secundario" onClick={cerrar} disabled={cerrado || puntos.length === 0}>
            Cerrar polígono
          </button>
          <button type="button" className="secundario" onClick={limpiar} disabled={puntos.length === 0}>
            Limpiar
          </button>
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
          <button type="button" className="advertencia" onClick={() => onGuardar(construirDatos(), true)} disabled={guardando}>
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
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar zona'}
        </button>
      </div>
    </form>
  )
}
