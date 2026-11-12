import { Activity, CalendarClock, MapPinned, Package, PackagePlus, Route, Truck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarPedidos } from '../api/pedidosApi'
import { listarRepartidores } from '../api/repartidoresApi'
import { listarRutas } from '../api/rutasApi'
import Avisos from '../components/Avisos'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoBadge from '../components/EstadoBadge'
import EstadoVacio from '../components/EstadoVacio'
import IndicadorConexion from '../components/IndicadorConexion'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_PEDIDOS, TOPIC_RUTAS } from '../services/websocket'
import { mensajeDeError } from '../utils/errores'
import { porcentajeEntregado, proximasEntregas } from '../utils/avance'
import { ESTADOS_PEDIDO } from '../utils/estados'

const ACCESOS = [
  { to: '/pedidos', titulo: 'Registrar pedidos', detalle: 'Alta, edición y filtros', icono: PackagePlus },
  { to: '/rutas', titulo: 'Armar rutas', detalle: 'Agrupar por zona y repartidor', icono: Route },
  { to: '/seguimiento', titulo: 'Seguimiento', detalle: 'Estados en tiempo real', icono: Activity },
  { to: '/zonas', titulo: 'Zonas de reparto', detalle: 'Dibujar y editar zonas', icono: MapPinned },
  { to: '/repartidores', titulo: 'Repartidores', detalle: 'Alta y disponibilidad', icono: Users },
]

function contarRutas(rutas) {
  return {
    total: rutas.length,
    armadas: rutas.filter((ruta) => ruta.estado === 'ARMADA').length,
    enCurso: rutas.filter((ruta) => ruta.estado === 'EN_CURSO').length,
  }
}

/** Número de una tarjeta: esqueleto mientras carga, "—" si la consulta falló y el valor cuando llegó. */
function Valor({ cargando, fallo, children }) {
  if (fallo) return '—'
  return cargando ? <span className="esqueleto esqueleto-numero" aria-hidden="true" /> : children
}

const NO_CARGO = 'No se pudo cargar'

/** Texto bajo un indicador: "Consultando…" o el fallo mientras no hay datos, y `listo` cuando llegaron. */
function textoDetalle({ cargando, fallo, listo, consultando = 'Consultando…', fallido = NO_CARGO }) {
  if (!cargando) return listo
  return fallo ? fallido : consultando
}

/** Encabezado de una tarjeta: icono y título. */
function CabeceraIndicador({ icono: Icono, children }) {
  return (
    <div className="indicador-cabecera">
      <span className="indicador-icono">
        <Icono size={18} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </div>
  )
}

/** Contenido de "Próximas entregas": mensaje de carga o fallo, estado vacío o la lista. */
function ProximasEntregas({ pedidos, fallo, proximas }) {
  if (pedidos === null) {
    return <p className="indicador-detalle">{fallo ? 'No se pudieron cargar las entregas' : 'Cargando próximas entregas…'}</p>
  }
  if (proximas.length === 0) {
    return <EstadoVacio titulo="No quedan entregas pendientes hoy." icono={CalendarClock} />
  }
  return (
    <ol className="proximas-lista" aria-label="Próximas entregas">
      {proximas.map((pedido) => (
        <li key={pedido.id}>
          <span className="proxima-hora">{pedido.horaEntrega?.slice(0, 5) ?? '—'}</span>
          <span className="proxima-texto">
            <strong>{pedido.clienteNombres}</strong>
            <span>{pedido.direccion}</span>
          </span>
          <EstadoBadge estado={pedido.estado} />
        </li>
      ))}
    </ol>
  )
}

/**
 * Panel de inicio: pedidos de hoy por estado, rutas armadas, repartidores disponibles y accesos rápidos.
 * Solo usa endpoints que ya existen (pedidos, rutas, repartidores) y se actualiza con el tiempo real.
 */
export default function InicioPage() {
  const [pedidos, setPedidos] = useState(null)
  const [rutasHoy, setRutasHoy] = useState(null)
  const [rutasManana, setRutasManana] = useState(null)
  const [repartidores, setRepartidores] = useState(null)
  const [error, setError] = useState(null)
  const [fallos, setFallos] = useState({})

  const marcar = useCallback((fuente, fallo) => setFallos((actuales) => ({ ...actuales, [fuente]: fallo })), [])

  const cargarPedidos = useCallback(async () => {
    try {
      setPedidos((await listarPedidos({ fecha: fechaIso(0), size: 1000 })).pedidos)
      marcar('pedidos', false)
    } catch (e) {
      marcar('pedidos', true)
      setError(mensajeDeError(e))
    }
  }, [marcar])

  const cargarRutas = useCallback(async () => {
    try {
      const [hoy, manana] = await Promise.all([listarRutas(fechaIso(0)), listarRutas(fechaIso(1))])
      setRutasHoy(hoy)
      setRutasManana(manana)
      marcar('rutas', false)
    } catch (e) {
      marcar('rutas', true)
      setError(mensajeDeError(e))
    }
  }, [marcar])

  const cargarRepartidores = useCallback(async () => {
    try {
      setRepartidores(await listarRepartidores())
      marcar('repartidores', false)
    } catch (e) {
      marcar('repartidores', true)
      setError(mensajeDeError(e))
    }
  }, [marcar])

  useEffect(() => {
    cargarPedidos()
    cargarRutas()
    cargarRepartidores()
  }, [cargarPedidos, cargarRutas, cargarRepartidores])

  const conectado = useWebSocketTopic(TOPIC_PEDIDOS, cargarPedidos)
  useWebSocketTopic(TOPIC_RUTAS, cargarRutas)

  const porEstado = (pedidos ?? []).reduce((acumulado, pedido) => {
    acumulado[pedido.estado] = (acumulado[pedido.estado] ?? 0) + 1
    return acumulado
  }, {})
  const entregados = porEstado.ENTREGADO ?? 0
  const avance = porcentajeEntregado(pedidos ?? [])
  const proximas = proximasEntregas(pedidos ?? [])
  const hoy = contarRutas(rutasHoy ?? [])
  const manana = contarRutas(rutasManana ?? [])
  const activos = (repartidores ?? []).filter((repartidor) => repartidor.activo !== false)
  const disponibles = activos.filter((repartidor) => repartidor.disponible)
  // una fuente "falló" solo si no hay ningún dato que mostrar
  const cargandoPedidos = pedidos === null
  const fallaPedidos = fallos.pedidos && cargandoPedidos
  const cargandoRutas = rutasHoy === null || rutasManana === null
  const cargandoRepartidores = repartidores === null

  return (
    <section>
      <EncabezadoPagina titulo="Inicio" descripcion="Resumen de la operación de hoy: pedidos, rutas y repartidores.">
        <IndicadorConexion conectado={conectado} />
      </EncabezadoPagina>

      <Avisos error={error} onCerrarError={() => setError(null)} />

      <h2 className="panel-seccion-titulo">Pedidos de hoy por estado</h2>
      <ul
        className="tarjetas-estado"
        aria-label="Pedidos de hoy por estado"
        aria-busy={cargandoPedidos && !fallos.pedidos}
      >
        {ESTADOS_PEDIDO.map((estado) => (
          <li key={estado} className={`tarjeta-estado acento-${estado}`}>
            <EstadoBadge estado={estado} />
            <span className="tarjeta-estado-numero">
              <Valor cargando={cargandoPedidos} fallo={fallaPedidos}>
                {porEstado[estado] ?? 0}
              </Valor>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="panel-seccion-titulo">Operación</h2>
      <div className="panel-rejilla">
        <article className="tarjeta indicador" aria-busy={cargandoPedidos && !fallos.pedidos}>
          <CabeceraIndicador icono={Package}>Pedidos de hoy</CabeceraIndicador>
          <span className="indicador-valor">
            <Valor cargando={cargandoPedidos} fallo={fallaPedidos}>
              {pedidos?.length}
            </Valor>
          </span>
          <p className="indicador-detalle">
            {textoDetalle({
              cargando: cargandoPedidos,
              fallo: fallos.pedidos,
              listo: `${porEstado.PENDIENTE ?? 0} pendientes de asignar a una ruta`,
            })}
          </p>
        </article>

        <article className="tarjeta indicador" aria-busy={cargandoRutas && !fallos.rutas}>
          <CabeceraIndicador icono={Route}>Rutas armadas hoy</CabeceraIndicador>
          <span className="indicador-valor">
            <Valor cargando={rutasHoy === null} fallo={fallos.rutas && rutasHoy === null}>
              {hoy.armadas}
            </Valor>
          </span>
          <p className="indicador-detalle">
            {textoDetalle({
              cargando: cargandoRutas,
              fallo: fallos.rutas,
              listo: `${hoy.enCurso} en curso · ${manana.armadas} armadas para mañana`,
            })}
          </p>
        </article>

        <article className="tarjeta indicador" aria-busy={cargandoRepartidores && !fallos.repartidores}>
          <CabeceraIndicador icono={Truck}>Repartidores disponibles</CabeceraIndicador>
          <span className="indicador-valor">
            <Valor cargando={cargandoRepartidores} fallo={fallos.repartidores && cargandoRepartidores}>
              {disponibles.length}
            </Valor>
          </span>
          <p className="indicador-detalle">
            {textoDetalle({
              cargando: cargandoRepartidores,
              fallo: fallos.repartidores,
              listo: `de ${activos.length} repartidores activos`,
            })}
          </p>
        </article>
      </div>

      <h2 className="panel-seccion-titulo">Avance del día</h2>
      <div className="dos-columnas">
        <article className="tarjeta avance" aria-busy={cargandoPedidos && !fallos.pedidos}>
          <CabeceraIndicador icono={Package}>Entregados hoy</CabeceraIndicador>
          <span className="indicador-valor">
            <Valor cargando={cargandoPedidos} fallo={fallaPedidos}>
              {avance} %
            </Valor>
          </span>
          <div
            className="barra-progreso"
            role="progressbar"
            aria-label="Pedidos entregados hoy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={avance}
          >
            <span style={{ width: `${avance}%` }} />
          </div>
          <p className="indicador-detalle">
            {textoDetalle({
              cargando: cargandoPedidos,
              fallo: fallos.pedidos,
              consultando: 'Calculando avance…',
              fallido: 'No se pudo calcular el avance',
              listo:
                pedidos?.length === 0 ? 'No hay pedidos para entregar hoy' : `${entregados} de ${pedidos?.length} pedidos entregados`,
            })}
          </p>
        </article>

        <article className="tarjeta proximas" aria-busy={cargandoPedidos && !fallos.pedidos}>
          <CabeceraIndicador icono={CalendarClock}>Próximas entregas</CabeceraIndicador>
          <ProximasEntregas pedidos={pedidos} fallo={fallos.pedidos} proximas={proximas} />
        </article>
      </div>

      <h2 className="panel-seccion-titulo">Accesos rápidos</h2>
      <ul className="accesos-rapidos">
        {ACCESOS.map(({ to, titulo, detalle, icono: Icono }) => (
          <li key={to}>
            <Link className="acceso-rapido" to={to}>
              <span className="acceso-rapido-icono">
                <Icono size={20} aria-hidden="true" />
              </span>
              <span className="acceso-rapido-texto">
                <span className="acceso-rapido-titulo">{titulo}</span>
                <span className="acceso-rapido-detalle">{detalle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
