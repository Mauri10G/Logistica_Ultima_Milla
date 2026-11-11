import EstadoBadge from './EstadoBadge'

/**
 * Tarjeta de una ruta con sus ajustes manuales: cambiar repartidor, subir/bajar paradas, sacar un pedido
 * y moverlo a otra ruta de la misma fecha. Los ajustes solo se ofrecen mientras la ruta está ARMADA.
 *
 * @param {object[]} repartidores repartidores disponibles (el de la ruta se agrega si falta)
 * @param {object[]} otrasRutas rutas de la misma fecha a las que se puede mover un pedido
 */
export default function RutaCard({
  ruta,
  color,
  repartidores = [],
  otrasRutas = [],
  ocupado = false,
  onCambiarRepartidor,
  onMover,
  onSacar,
  onReordenar,
}) {
  const editable = ruta.estado === 'ARMADA'
  const opcionesRepartidor = repartidores.some((r) => r.id === ruta.repartidorId)
    ? repartidores
    : [{ id: ruta.repartidorId, nombres: ruta.repartidorNombre }, ...repartidores]
  const ids = ruta.pedidos.map((pedido) => pedido.id)

  function intercambiar(indice, destino) {
    const nuevoOrden = [...ids]
    ;[nuevoOrden[indice], nuevoOrden[destino]] = [nuevoOrden[destino], nuevoOrden[indice]]
    onReordenar(ruta, nuevoOrden)
  }

  return (
    <article
      className="tarjeta ruta"
      data-testid="ruta-card"
      data-total={ruta.pedidos.length}
      style={{ borderLeftColor: color }}
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

      {editable && (
        <div className="campo campo-en-linea">
          <label htmlFor={`repartidor-ruta-${ruta.id}`}>Cambiar repartidor de la ruta {ruta.id}</label>
          <select
            id={`repartidor-ruta-${ruta.id}`}
            value={ruta.repartidorId}
            disabled={ocupado}
            onChange={(e) => onCambiarRepartidor(ruta, Number(e.target.value))}
          >
            {opcionesRepartidor.map((repartidor) => (
              <option key={repartidor.id} value={repartidor.id}>
                {repartidor.nombres}
              </option>
            ))}
          </select>
        </div>
      )}

      <ol className="paradas">
        {ruta.pedidos.map((pedido, indice) => (
          <li key={pedido.id}>
            <span>
              {pedido.horaEntrega?.slice(0, 5)} · {pedido.direccion} <EstadoBadge estado={pedido.estado} />
            </span>
            {editable && (
              <span className="ajustes-parada">
                <button
                  type="button"
                  className="secundario"
                  aria-label={`Subir la parada del pedido ${pedido.id}`}
                  disabled={ocupado || indice === 0}
                  onClick={() => intercambiar(indice, indice - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="secundario"
                  aria-label={`Bajar la parada del pedido ${pedido.id}`}
                  disabled={ocupado || indice === ids.length - 1}
                  onClick={() => intercambiar(indice, indice + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="peligro"
                  aria-label={`Sacar el pedido ${pedido.id} de la ruta`}
                  disabled={ocupado}
                  onClick={() => onSacar(ruta, pedido)}
                >
                  Sacar
                </button>
                {otrasRutas.length > 0 && (
                  <>
                    <label className="solo-lectores" htmlFor={`mover-${ruta.id}-${pedido.id}`}>
                      Mover el pedido {pedido.id} a otra ruta
                    </label>
                    <select
                      id={`mover-${ruta.id}-${pedido.id}`}
                      value=""
                      disabled={ocupado}
                      onChange={(e) => onMover(ruta, pedido, Number(e.target.value))}
                    >
                      <option value="">Mover a…</option>
                      {otrasRutas.map((otra) => (
                        <option key={otra.id} value={otra.id}>
                          Ruta {otra.id} · {otra.zonaNombre} ({otra.pedidos.length}/{otra.maxPedidos})
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>
    </article>
  )
}
