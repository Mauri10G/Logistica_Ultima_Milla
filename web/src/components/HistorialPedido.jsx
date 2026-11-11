import { formatearFechaHora } from '../utils/formatos'
import EstadoBadge from './EstadoBadge'

/** Panel con la línea de tiempo de estados de un pedido (GET /api/seguimiento/pedidos/{id}/historial). */
export default function HistorialPedido({ pedido, historial, error, onCerrar }) {
  return (
    <aside className="tarjeta panel-historial" aria-label={`Historial del pedido ${pedido.id}`}>
      <header className="encabezado">
        <h3>Historial del pedido {pedido.id}</h3>
        <button type="button" className="secundario" onClick={onCerrar}>
          Cerrar historial
        </button>
      </header>
      <p>
        {pedido.clienteNombres} · {pedido.direccion}
      </p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      {!error && historial === null && <p className="vacio">Cargando historial…</p>}
      {!error && historial?.length === 0 && <p className="vacio">Este pedido aún no tiene cambios de estado.</p>}
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
    </aside>
  )
}
