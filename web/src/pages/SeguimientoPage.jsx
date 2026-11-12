import { Eye, PackageSearch } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listarPedidos } from '../api/pedidosApi'
import { obtenerHistorial } from '../api/seguimientoApi'
import { mensajeDeError } from '../utils/errores'
import Avisos from '../components/Avisos'
import Buscador from '../components/Buscador'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoBadge from '../components/EstadoBadge'
import EstadoVacio from '../components/EstadoVacio'
import HistorialPedido from '../components/HistorialPedido'
import IndicadorConexion from '../components/IndicadorConexion'
import Tabla from '../components/Tabla'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_PEDIDOS } from '../services/websocket'
import { coincide } from '../utils/busqueda'
import { ESTADOS_PEDIDO } from '../utils/estados'

const COLUMNAS = [
  { clave: 'id', titulo: '#' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'direccion', titulo: 'Dirección' },
  { clave: 'zona', titulo: 'Zona' },
  { clave: 'hora', titulo: 'Hora' },
  { clave: 'ruta', titulo: 'Ruta' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'historial', titulo: 'Historial' },
]

const VALORES = {
  id: (pedido) => pedido.id,
  cliente: (pedido) => pedido.clienteNombres,
  direccion: (pedido) => pedido.direccion,
  zona: (pedido) => pedido.zonaNombre,
  hora: (pedido) => pedido.horaEntrega,
  ruta: (pedido) => pedido.rutaId,
  estado: (pedido) => ESTADOS_PEDIDO.indexOf(pedido.estado),
}

// Al cargar o recargar, la tabla viene por número de pedido de menor a mayor.
const ORDEN_INICIAL = { clave: 'id', direccion: 'asc' }

/**
 * Seguimiento en tiempo real (CP-11): cuando el repartidor cambia el estado de un pedido desde la app
 * movil, el backend publica en /topic/pedidos y esta tabla se actualiza sola, sin recargar.
 * Al elegir un pedido se muestra su historial, que también se recarga solo si llega un cambio suyo.
 */
export default function SeguimientoPage() {
  const [fecha, setFecha] = useState(fechaIso(0))
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [pedidos, setPedidos] = useState([])
  const [recienActualizados, setRecienActualizados] = useState(new Set())
  const [error, setError] = useState(null)
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [historial, setHistorial] = useState(null)
  const [errorHistorial, setErrorHistorial] = useState(null)
  const [cargando, setCargando] = useState(true)
  const temporizadores = useRef([])
  const seleccionadoRef = useRef(null)

  const cargar = useCallback(async () => {
    try {
      const resultado = await listarPedidos({ fecha, size: 1000 })
      setPedidos(resultado.pedidos)
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
    const pendientes = temporizadores.current
    return () => pendientes.forEach(clearTimeout)
  }, [])

  const cargarHistorial = useCallback(async (pedidoId) => {
    try {
      const datos = await obtenerHistorial(pedidoId)
      if (seleccionadoRef.current === pedidoId) {
        setHistorial(datos)
        setErrorHistorial(null)
      }
    } catch (e) {
      if (seleccionadoRef.current === pedidoId) setErrorHistorial(mensajeDeError(e))
    }
  }, [])

  function seleccionar(pedido) {
    seleccionadoRef.current = pedido.id
    setSeleccionadoId(pedido.id)
    setHistorial(null)
    setErrorHistorial(null)
    cargarHistorial(pedido.id)
  }

  function cerrarHistorial() {
    seleccionadoRef.current = null
    setSeleccionadoId(null)
    setHistorial(null)
    setErrorHistorial(null)
  }

  const conectado = useWebSocketTopic(TOPIC_PEDIDOS, (cambio) => {
    setPedidos((actuales) =>
      actuales.map((pedido) => (pedido.id === cambio.pedidoId ? { ...pedido, estado: cambio.estadoNuevo } : pedido)),
    )
    setRecienActualizados((ids) => new Set(ids).add(cambio.pedidoId))
    temporizadores.current.push(
      setTimeout(() => {
        setRecienActualizados((ids) => {
          const restantes = new Set(ids)
          restantes.delete(cambio.pedidoId)
          return restantes
        })
      }, 3000),
    )
    if (cambio.pedidoId === seleccionadoRef.current) cargarHistorial(cambio.pedidoId)
  })

  const resumen = pedidos.reduce((acumulado, pedido) => {
    acumulado[pedido.estado] = (acumulado[pedido.estado] ?? 0) + 1
    return acumulado
  }, {})

  const seleccionado = pedidos.find((pedido) => pedido.id === seleccionadoId)
  const visibles = pedidos.filter(
    (pedido) => (!estadoFiltro || pedido.estado === estadoFiltro) && coincide(busqueda, pedido.clienteNombres, pedido.direccion),
  )

  return (
    <section>
      <EncabezadoPagina
        titulo="Seguimiento de entregas"
        descripcion="Estado de cada pedido en tiempo real; elija uno para ver su historial."
      >
        <IndicadorConexion conectado={conectado} />
      </EncabezadoPagina>

      <Avisos error={error} onCerrarError={() => setError(null)} />

      <div className="filtros">
        <div className="campo">
          <label htmlFor="segFecha">Fecha de entrega</label>
          <input id="segFecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <button type="button" className="secundario" onClick={() => setFecha(fechaIso(0))}>
          Hoy
        </button>
        <button type="button" className="secundario" onClick={() => setFecha(fechaIso(1))}>
          Mañana
        </button>
        <Buscador
          id="segBuscar"
          etiqueta="Buscar por cliente o dirección"
          valor={busqueda}
          onCambiar={setBusqueda}
          placeholder="Nombre o calle"
        />
      </div>

      <ul className="resumen" aria-label="Filtrar por estado">
        <li>
          <button
            type="button"
            className="pastilla-filtro"
            aria-pressed={estadoFiltro === ''}
            onClick={() => setEstadoFiltro('')}
          >
            Todos {pedidos.length}
          </button>
        </li>
        {ESTADOS_PEDIDO.map((estado) => (
          <li key={estado}>
            <button
              type="button"
              className="pastilla-filtro"
              aria-pressed={estadoFiltro === estado}
              onClick={() => setEstadoFiltro(estadoFiltro === estado ? '' : estado)}
            >
              <EstadoBadge estado={estado} /> {resumen[estado] ?? 0}
            </button>
          </li>
        ))}
      </ul>

      <div className={seleccionado ? 'dos-columnas dos-columnas-historial' : undefined}>
        <Tabla
          titulo="Pedidos de la fecha con su estado actual"
          columnas={COLUMNAS}
          valores={VALORES}
          filas={visibles}
          cargando={cargando}
          ordenInicial={ORDEN_INICIAL}
          reiniciarCon={[fecha, busqueda, estadoFiltro]}
          vacio={
            <EstadoVacio
              icono={PackageSearch}
              titulo="No hay pedidos para esta fecha."
              ayuda="Elija otra fecha, otro estado o cambie la búsqueda para ver sus entregas."
            />
          }
          renderFila={(pedido) => (
            <tr
              key={pedido.id}
              className={[
                recienActualizados.has(pedido.id) ? 'fila-actualizada' : '',
                pedido.id === seleccionadoId ? 'fila-seleccionada' : '',
              ]
                .join(' ')
                .trim() || undefined}
            >
              <td>{pedido.id}</td>
              <td>{pedido.clienteNombres}</td>
              <td>{pedido.direccion}</td>
              <td>{pedido.zonaNombre}</td>
              <td className="celda-fecha">{pedido.horaEntrega?.slice(0, 5)}</td>
              <td>{pedido.rutaId ?? '—'}</td>
              <td data-testid={`estado-pedido-${pedido.id}`}>
                <EstadoBadge estado={pedido.estado} />
              </td>
              <td>
                <button
                  type="button"
                  className="secundario pequeno"
                  aria-label={`Ver historial del pedido ${pedido.id}`}
                  aria-pressed={pedido.id === seleccionadoId}
                  onClick={() => seleccionar(pedido)}
                >
                  <Eye size={14} aria-hidden="true" />
                  Ver historial
                </button>
              </td>
            </tr>
          )}
        />

        {seleccionado && (
          <HistorialPedido pedido={seleccionado} historial={historial} error={errorHistorial} onCerrar={cerrarHistorial} />
        )}
      </div>
    </section>
  )
}
