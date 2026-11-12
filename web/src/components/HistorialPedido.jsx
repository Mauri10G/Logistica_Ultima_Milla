import { History, X } from 'lucide-react'
import { formatearFechaHora } from '../utils/formatos'
import Cargando from './Cargando'
import EstadoBadge from './EstadoBadge'
import EstadoVacio from './EstadoVacio'

/**
 * Línea de tiempo de estados de un pedido: error, carga, vacío o la lista de cambios.
 * La comparten el panel de Seguimiento y el detalle de un pedido en Pedidos.
 */
export function LineaTiempoHistorial({ historial, error }) {
  return (
    <>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      {!error && historial === null && <Cargando texto="Cargando historial…" bloque />}
      {!error && historial?.length === 0 && (
        <EstadoVacio titulo="Este pedido aún no tiene cambios de estado." icono={History} />
      )}
      {historial?.length > 0 && (
        <ol className="linea-tiempo">
          {historial.map((cambio) => (
            <li key={cambio.id}>
              <span className="hora">{formatearFechaHora(cambio.fechaCambio)}</span>
              {cambio.estadoAnterior ? <EstadoBadge estado={cambio.estadoAnterior} /> : <em>Registro</em>}
              {' → '}
              <EstadoBadge estado={cambio.estadoNuevo} />
              <span className="origen">{cambio.origen}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

/** Panel con la línea de tiempo de estados de un pedido (GET /api/seguimiento/pedidos/{id}/historial). */
export default function HistorialPedido({ pedido, historial, error, onCerrar }) {
  return (
    <aside className="tarjeta panel-historial" aria-label={`Historial del pedido ${pedido.id}`}>
      <header className="encabezado">
        <h2>Historial del pedido {pedido.id}</h2>
        <button type="button" className="secundario pequeno" onClick={onCerrar}>
          <X size={16} aria-hidden="true" />
          Cerrar historial
        </button>
      </header>
      <p>
        {pedido.clienteNombres} · {pedido.direccion}
      </p>
      <LineaTiempoHistorial historial={historial} error={error} />
    </aside>
  )
}
