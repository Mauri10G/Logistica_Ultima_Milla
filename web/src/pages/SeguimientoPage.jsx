import { Eye, PackageSearch } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { TablaVista } from '../components/Tabla'
import { fechaIso } from '../hooks/fechas'
import { usePedidosTabla } from '../hooks/usePedidosTabla'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_PEDIDOS } from '../services/websocket'
import { ESTADOS_PEDIDO } from '../utils/estados'

const COLUMNAS = [
  { clave: 'id', titulo: '#' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'direccion', titulo: 'Dirección' },
  { clave: 'zona', titulo: 'Zona' },
  { clave: 'hora', titulo: 'Hora' },
  { clave: 'ruta', titulo: 'Ruta', ordenable: false },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'historial', titulo: 'Historial', ordenable: false },
]

/** Cuántos pedidos hay de la fecha en cada estado (una consulta de tamaño 1 por estado: solo interesa X-Total-Count). */
async function contarPorEstado(fecha) {
  const totales = await Promise.all(ESTADOS_PEDIDO.map((estado) => listarPedidos({ fecha, estado, size: 1 })))
  return Object.fromEntries(ESTADOS_PEDIDO.map((estado, i) => [estado, totales[i].total]))
}

/**
 * Seguimiento en tiempo real (CP-11): cuando el repartidor cambia el estado de un pedido desde la app
 * movil, el backend publica en /topic/pedidos y esta tabla se actualiza sola, sin recargar.
 * Al elegir un pedido se muestra su historial, que también se recarga solo si llega un cambio suyo.
 */
export default function SeguimientoPage() {
  const [fecha, setFecha] = useState(fechaIso(0))
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [resumen, setResumen] = useState({})
  const [recienActualizados, setRecienActualizados] = useState(new Set())
  const [errorResumen, setErrorResumen] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null) // el pedido elegido: sigue abierto aunque se cambie de página
  const [historial, setHistorial] = useState(null)
  const [errorHistorial, setErrorHistorial] = useState(null)
  const temporizadores = useRef([])
  const seleccionadoRef = useRef(null)

  // El backend filtra por fecha y estado, busca por cliente o dirección, ordena y pagina (ver usePedidosTabla).
  const filtros = useMemo(() => ({ fecha, estado: estadoFiltro }), [fecha, estadoFiltro])
  const { tabla, setPedidos, cargando, error: errorLista, setError: setErrorLista, recargar } = usePedidosTabla({
    filtros,
    busqueda,
  })

  // Las pastillas cuentan todos los pedidos de la fecha, no solo la página que se ve.
  const cargarResumen = useCallback(async () => {
    try {
      setResumen(await contarPorEstado(fecha))
      setErrorResumen(null)
    } catch (e) {
      setErrorResumen(mensajeDeError(e))
    }
  }, [fecha])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

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
    setSeleccionado(pedido)
    setHistorial(null)
    setErrorHistorial(null)
    cargarHistorial(pedido.id)
  }

  function cerrarHistorial() {
    seleccionadoRef.current = null
    setSeleccionado(null)
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
    if (cambio.pedidoId === seleccionadoRef.current) {
      setSeleccionado((actual) => ({ ...actual, estado: cambio.estadoNuevo }))
      cargarHistorial(cambio.pedidoId)
    }
    // los totales de las pastillas cambian; con un filtro de estado, además, el pedido puede salir de la lista
    cargarResumen()
    if (estadoFiltro) recargar()
  })

  const totalPedidos = ESTADOS_PEDIDO.reduce((suma, estado) => suma + (resumen[estado] ?? 0), 0)

  return (
    <section>
      <EncabezadoPagina
        titulo="Seguimiento de entregas"
        descripcion="Estado de cada pedido en tiempo real; elija uno para ver su historial."
      >
        <IndicadorConexion conectado={conectado} />
      </EncabezadoPagina>

      <Avisos
        error={errorLista ?? errorResumen}
        onCerrarError={() => {
          setErrorLista(null)
          setErrorResumen(null)
        }}
      />

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
            Todos {totalPedidos}
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
        <TablaVista
          tabla={tabla}
          titulo="Pedidos de la fecha con su estado actual"
          columnas={COLUMNAS}
          cargando={cargando}
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
                pedido.id === seleccionado?.id ? 'fila-seleccionada' : '',
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
                  aria-pressed={pedido.id === seleccionado?.id}
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
