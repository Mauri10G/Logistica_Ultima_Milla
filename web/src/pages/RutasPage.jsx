import { Route, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { listarPedidos } from '../api/pedidosApi'
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
import { useConfirmacion } from '../hooks/useConfirmacion'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_RUTAS } from '../services/websocket'
import { formatearFecha } from '../utils/formatos'

export default function RutasPage() {
  const [fecha, setFecha] = useState(fechaIso(1))
  const [rutas, setRutas] = useState([])
  const [repartidores, setRepartidores] = useState([])
  const [armando, setArmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [rutaResaltadaId, setRutaResaltadaId] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const { pedir, dialogo } = useConfirmacion()

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

  /** Pedidos PENDIENTE de la fecha que el armado va a agrupar; null si no se pudo consultar. */
  async function contarPendientes() {
    try {
      return (await listarPedidos({ fecha, estado: 'PENDIENTE', size: 1 })).total
    } catch {
      return null
    }
  }

  async function ejecutarArmado() {
    setArmando(true)
    try {
      const nuevas = await armarRutas(fecha)
      setMensaje(
        nuevas.length === 0
          ? `No había pedidos pendientes para el ${formatearFecha(fecha)}.`
          : `Se armaron ${nuevas.length} ruta(s) para el ${formatearFecha(fecha)}.`,
      )
      await cargar()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setArmando(false)
    }
  }

  /** Pide confirmación con la fecha y cuántos pedidos pendientes se van a agrupar, y recién entonces arma. */
  async function armar() {
    setMensaje(null)
    setError(null)
    setArmando(true) // mientras se consulta cuántos pedidos hay
    const pendientes = await contarPendientes()
    setArmando(false)
    const fechaTexto = formatearFecha(fecha)
    if (pendientes === 0) {
      setMensaje(`No hay pedidos pendientes para el ${fechaTexto}: no hay rutas que armar.`)
      return
    }
    await pedir({
      titulo: `¿Armar las rutas del ${fechaTexto}?`,
      descripcion:
        pendientes === null
          ? 'Se agruparán por zona los pedidos pendientes de esa fecha y se asignarán a repartidores disponibles.'
          : `Se agruparán por zona ${pendientes} pedido(s) pendiente(s) de esa fecha y se asignarán a repartidores disponibles.`,
      detalles: [
        ['Fecha de entrega', fechaTexto],
        ['Pedidos pendientes', pendientes === null ? 'No se pudo consultar' : String(pendientes)],
      ],
      textoConfirmar: 'Armar rutas',
      textoCargando: 'Armando…',
      variante: 'normal',
      onConfirmar: ejecutarArmado,
    })
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

  const moverPedido = (ruta, pedido, rutaDestinoId) => {
    const destino = rutas.find((otra) => otra.id === rutaDestinoId)
    return pedir({
      titulo: `¿Mover el pedido ${pedido.id} a la ruta ${rutaDestinoId}?`,
      descripcion: 'El pedido dejará la ruta actual y pasará a la ruta elegida. Si esa ruta ya está llena, el sistema lo rechazará.',
      detalles: [
        ['Pedido', `${pedido.id} · ${pedido.direccion}`],
        ['Sale de', `Ruta ${ruta.id} · ${ruta.zonaNombre} · ${ruta.repartidorNombre}`],
        [
          'Pasa a',
          destino
            ? `Ruta ${destino.id} · ${destino.zonaNombre} · ${destino.repartidorNombre} (${destino.pedidos.length}/${destino.maxPedidos} pedidos)`
            : `Ruta ${rutaDestinoId}`,
        ],
      ],
      textoConfirmar: 'Mover pedido',
      textoCargando: 'Moviendo…',
      variante: 'normal',
      onConfirmar: () =>
        ajustar(() => moverPedidoARuta(rutaDestinoId, pedido.id), `El pedido ${pedido.id} se movió a la ruta ${rutaDestinoId}.`),
    })
  }

  const sacarPedido = (ruta, pedido) =>
    pedir({
      titulo: `¿Sacar el pedido ${pedido.id} de la ruta ${ruta.id}?`,
      descripcion: 'El pedido volverá a PENDIENTE y quedará sin ruta hasta que se arme otra o se mueva a una existente.',
      detalles: [
        ['Pedido', `${pedido.id} · ${pedido.direccion}`],
        ['Ruta', `Ruta ${ruta.id} · ${ruta.zonaNombre} · ${ruta.repartidorNombre}`],
      ],
      textoConfirmar: 'Sacar pedido',
      textoCargando: 'Sacando…',
      variante: 'advertencia',
      onConfirmar: () =>
        ajustar(
          () => sacarPedidoDeRuta(ruta.id, pedido.id),
          `El pedido ${pedido.id} salió de la ruta ${ruta.id} y volvió a PENDIENTE.`,
        ),
    })

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

      {dialogo}

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
              resaltada={ruta.id === rutaResaltadaId}
              onResaltar={setRutaResaltadaId}
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
        <div className="tarjeta columna-fija">
          <MapaRutas rutas={rutas} rutaResaltadaId={rutaResaltadaId} />
        </div>
      </div>
    </section>
  )
}
