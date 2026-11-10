import { useCallback, useEffect, useState } from 'react'
import { armarRutas, listarRutas } from '../api/rutasApi'
import { mensajeDeError } from '../api/client'
import EstadoBadge from '../components/EstadoBadge'
import { COLORES_RUTA } from '../components/constantesMapa'
import MapaRutas from '../components/MapaRutas'
import { fechaIso } from '../hooks/fechas'
import { TOPIC_RUTAS } from '../services/websocket'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'

export default function RutasPage() {
  const [fecha, setFecha] = useState(fechaIso(1))
  const [rutas, setRutas] = useState([])
  const [armando, setArmando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setRutas(await listarRutas(fecha))
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [fecha])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Si otra persona (o el armado programado) arma o modifica rutas de esta fecha, se refresca sola.
  useWebSocketTopic(TOPIC_RUTAS, (mensajeWs) => {
    if (mensajeWs.fecha === fecha) cargar()
  })

  async function armar() {
    setArmando(true)
    setMensaje(null)
    setError(null)
    try {
      const nuevas = await armarRutas(fecha)
      setMensaje(
        nuevas.length === 0
          ? 'No había pedidos pendientes para esa fecha.'
          : `Se armaron ${nuevas.length} ruta(s).`,
      )
      await cargar()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setArmando(false)
    }
  }

  return (
    <section>
      <header className="encabezado">
        <h2>Rutas</h2>
      </header>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="rutasFecha">Fecha de entrega</label>
          <input id="rutasFecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <button type="button" className="secundario" onClick={() => setFecha(fechaIso(0))}>
          Hoy
        </button>
        <button type="button" className="secundario" onClick={() => setFecha(fechaIso(1))}>
          Mañana
        </button>
        <button type="button" onClick={armar} disabled={armando || !fecha}>
          {armando ? 'Armando…' : 'Armar rutas'}
        </button>
      </div>

      {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      {error && <p className="mensaje-error">{error}</p>}

      <div className="dos-columnas">
        <div className="lista-rutas">
          {rutas.map((ruta, indice) => (
            <article
              key={ruta.id}
              className="tarjeta ruta"
              data-testid="ruta-card"
              data-total={ruta.pedidos.length}
              style={{ borderLeftColor: COLORES_RUTA[indice % COLORES_RUTA.length] }}
            >
              <header>
                <strong>
                  Ruta {ruta.id} · {ruta.zonaNombre}
                </strong>
                <EstadoBadge estado={ruta.estado} />
              </header>
              <p>
                Repartidor: {ruta.repartidorNombre} · {ruta.pedidos.length}/{ruta.maxPedidos} pedidos
              </p>
              <ol>
                {ruta.pedidos.map((pedido) => (
                  <li key={pedido.id}>
                    {pedido.horaEntrega?.slice(0, 5)} · {pedido.direccion} <EstadoBadge estado={pedido.estado} />
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {rutas.length === 0 && <p className="vacio">No hay rutas armadas para esta fecha.</p>}
        </div>
        <div className="tarjeta">
          <MapaRutas rutas={rutas} />
        </div>
      </div>
    </section>
  )
}
