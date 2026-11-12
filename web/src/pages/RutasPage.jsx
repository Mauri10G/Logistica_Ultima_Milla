import { Route, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { listarRepartidores } from '../api/repartidoresApi'
import {
  armarRutas,
  cambiarRepartidorDeRuta,
  listarRutas,
  moverPedidoARuta,
  reordenarRuta,
  sacarPedidoDeRuta,
} from '../api/rutasApi'
import { endpointNoDisponible, MENSAJE_FUNCION_NO_DISPONIBLE, mensajeDeError } from '../utils/errores'
import Avisos from '../components/Avisos'
import Cargando from '../components/Cargando'
import { colorDeRuta } from '../components/constantesMapa'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoVacio from '../components/EstadoVacio'
import IndicadorConexion from '../components/IndicadorConexion'
import MapaRutas from '../components/MapaRutas'
import RutaCard from '../components/RutaCard'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_RUTAS } from '../services/websocket'

export default function RutasPage() {
  const [fecha, setFecha] = useState(fechaIso(1))
  const [rutas, setRutas] = useState([])
  const [repartidores, setRepartidores] = useState([])
  const [armando, setArmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    try {
      setRutas(await listarRutas(fecha))
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }, [fecha])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    listarRepartidores()
      .then(setRepartidores)
      .catch((e) => setError(mensajeDeError(e)))
  }, [])

  // Si otra persona (o el armado programado) arma o modifica rutas de esta fecha, se refresca sola.
  const conectado = useWebSocketTopic(TOPIC_RUTAS, (mensajeWs) => {
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

  /** Ejecuta un ajuste manual. Si el endpoint aún no existe (404/405) avisa sin romper la pantalla. */
  async function ajustar(accion, textoOk) {
    setOcupado(true)
    setMensaje(null)
    setError(null)
    try {
      await accion()
      setMensaje(textoOk)
      await cargar()
    } catch (e) {
      if (endpointNoDisponible(e)) {
        setError(MENSAJE_FUNCION_NO_DISPONIBLE)
      } else {
        await cargar() // el estado pudo haber cambiado; recargar limpia el error, por eso se muestra después
        setError(mensajeDeError(e)) // p. ej. 409 "La ruta ya tiene el máximo de 4 pedidos"
      }
    } finally {
      setOcupado(false)
    }
  }

  const cambiarRepartidor = (ruta, repartidorId) =>
    ajustar(() => cambiarRepartidorDeRuta(ruta.id, repartidorId), `Se cambió el repartidor de la ruta ${ruta.id}.`)

  const moverPedido = (ruta, pedido, rutaDestinoId) =>
    ajustar(
      () => moverPedidoARuta(rutaDestinoId, pedido.id),
      `El pedido ${pedido.id} se movió a la ruta ${rutaDestinoId}.`,
    )

  const sacarPedido = (ruta, pedido) =>
    ajustar(
      () => sacarPedidoDeRuta(ruta.id, pedido.id),
      `El pedido ${pedido.id} salió de la ruta ${ruta.id} y volvió a PENDIENTE.`,
    )

  const reordenar = (ruta, nuevoOrden) =>
    ajustar(() => reordenarRuta(ruta.id, nuevoOrden), `Se cambió el orden de las paradas de la ruta ${ruta.id}.`)

  const repartidoresDisponibles = repartidores.filter((r) => r.disponible && r.activo !== false)

  return (
    <section>
      <EncabezadoPagina
        titulo="Rutas"
        descripcion="Arme las rutas de un día, ajuste las paradas y vea el recorrido en el mapa."
      >
        <IndicadorConexion conectado={conectado} />
        <button type="button" onClick={armar} disabled={armando || !fecha}>
          <Zap size={18} aria-hidden="true" />
          {armando ? 'Armando…' : 'Armar rutas'}
        </button>
      </EncabezadoPagina>

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
      </div>

      <Avisos
        mensaje={mensaje}
        error={error}
        onCerrarMensaje={() => setMensaje(null)}
        onCerrarError={() => setError(null)}
      />

      <div className="dos-columnas">
        <div className="lista-rutas">
          {rutas.map((ruta, indice) => (
            <RutaCard
              key={ruta.id}
              ruta={ruta}
              color={colorDeRuta(indice)}
              repartidores={repartidoresDisponibles}
              otrasRutas={rutas.filter((otra) => otra.id !== ruta.id && otra.estado === 'ARMADA')}
              ocupado={ocupado}
              onCambiarRepartidor={cambiarRepartidor}
              onMover={moverPedido}
              onSacar={sacarPedido}
              onReordenar={reordenar}
            />
          ))}
          {cargando && <Cargando texto="Cargando rutas…" bloque />}
          {!cargando && rutas.length === 0 && (
            <div className="tarjeta">
              <EstadoVacio
                icono={Route}
                titulo="No hay rutas armadas para esta fecha."
                ayuda="Pulse «Armar rutas» para agrupar los pedidos pendientes de la fecha elegida."
              />
            </div>
          )}
        </div>
        <div className="tarjeta">
          <MapaRutas rutas={rutas} />
        </div>
      </div>
    </section>
  )
}
