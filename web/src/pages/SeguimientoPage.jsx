import { useCallback, useEffect, useRef, useState } from 'react'
import { listarPedidos } from '../api/pedidosApi'
import { mensajeDeError } from '../api/client'
import EstadoBadge from '../components/EstadoBadge'
import { fechaIso } from '../hooks/fechas'
import { useWebSocketTopic } from '../hooks/useWebSocketTopic'
import { TOPIC_PEDIDOS } from '../services/websocket'

/**
 * Seguimiento en tiempo real (CP-11): cuando el repartidor cambia el estado de un pedido desde la app
 * movil, el backend publica en /topic/pedidos y esta tabla se actualiza sola, sin recargar.
 */
export default function SeguimientoPage() {
  const [fecha, setFecha] = useState(fechaIso(0))
  const [pedidos, setPedidos] = useState([])
  const [recienActualizados, setRecienActualizados] = useState(new Set())
  const [error, setError] = useState(null)
  const temporizadores = useRef([])

  const cargar = useCallback(async () => {
    try {
      const resultado = await listarPedidos({ fecha, size: 1000 })
      setPedidos(resultado.pedidos)
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [fecha])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    const pendientes = temporizadores.current
    return () => pendientes.forEach(clearTimeout)
  }, [])

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
  })

  const resumen = pedidos.reduce((acumulado, pedido) => {
    acumulado[pedido.estado] = (acumulado[pedido.estado] ?? 0) + 1
    return acumulado
  }, {})

  return (
    <section>
      <header className="encabezado">
        <h2>Seguimiento de entregas</h2>
        <span className={conectado ? 'conexion conexion-ok' : 'conexion conexion-error'} role="status">
          Tiempo real: {conectado ? 'conectado' : 'desconectado'}
        </span>
      </header>

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
      </div>

      <ul className="resumen">
        {['PENDIENTE', 'ASIGNADO', 'RECOGIDO', 'EN_CAMINO', 'ENTREGADO'].map((estado) => (
          <li key={estado}>
            <EstadoBadge estado={estado} /> {resumen[estado] ?? 0}
          </li>
        ))}
      </ul>

      {error && <p className="mensaje-error">{error}</p>}
      <table className="tabla">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Dirección</th>
            <th>Zona</th>
            <th>Ruta</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido) => (
            <tr key={pedido.id} className={recienActualizados.has(pedido.id) ? 'fila-actualizada' : undefined}>
              <td>{pedido.id}</td>
              <td>{pedido.clienteNombres}</td>
              <td>{pedido.direccion}</td>
              <td>{pedido.zonaNombre}</td>
              <td>{pedido.rutaId ?? '—'}</td>
              <td data-testid={`estado-pedido-${pedido.id}`}>
                <EstadoBadge estado={pedido.estado} />
              </td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={6} className="vacio">
                No hay pedidos para esta fecha.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
