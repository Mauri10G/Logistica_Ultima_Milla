import { Check, ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import EstadoBadge from './EstadoBadge'

/**
 * Tarjeta de una ruta: un resumen compacto (repartidor, zona, pedidos y barra de capacidad) y, al pulsar
 * "Ajustar ruta", sus ajustes manuales: cambiar repartidor, subir/bajar paradas, sacar un pedido y moverlo a
 * otra ruta de la misma fecha. "Listo" vuelve a ocultarlos. Los ajustes solo se ofrecen mientras la ruta está ARMADA.
 *
 * @param {object[]} repartidores repartidores disponibles (el de la ruta se agrega si falta)
 * @param {object[]} otrasRutas rutas de la misma fecha a las que se puede mover un pedido
 * @param {boolean} [resaltada] la ruta está resaltada en el mapa (mouse encima)
 * @param {(rutaId: number | null) => void} [onResaltar] avisa qué ruta resaltar en el mapa (null al salir)
 */
export default function RutaCard({
  ruta,
  color,
  repartidores = [],
  otrasRutas = [],
  ocupado = false,
  resaltada = false,
  onResaltar,
  onCambiarRepartidor,
  onMover,
  onSacar,
  onReordenar,
}) {
  const [ajustando, setAjustando] = useState(false)
  const editable = ruta.estado === 'ARMADA'
  const conControles = editable && ajustando
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
      className={resaltada ? 'tarjeta ruta ruta-resaltada' : 'tarjeta ruta'}
      data-testid="ruta-card"
      data-total={ruta.pedidos.length}
      style={{ borderLeftColor: color }}
      onMouseEnter={() => onResaltar?.(ruta.id)}
      onMouseLeave={() => onResaltar?.(null)}
      onFocus={() => onResaltar?.(ruta.id)}
      onBlur={() => onResaltar?.(null)}
    >
      <header>
        <strong>
          Ruta {ruta.id} · {ruta.zonaNombre}
        </strong>
        <EstadoBadge estado={ruta.estado} />
      </header>
      <p className="ruta-resumen">
        Repartidor: {ruta.repartidorNombre} · {ruta.pedidos.length}/{ruta.maxPedidos} pedidos
      </p>
      <div className={ruta.pedidos.length >= ruta.maxPedidos ? 'ruta-barra ruta-barra-llena' : 'ruta-barra'} aria-hidden="true">
        <span style={{ width: `${Math.min(100, (ruta.pedidos.length / (ruta.maxPedidos || 1)) * 100)}%` }} />
      </div>

      {editable && (
        <button
          type="button"
          className="secundario pequeno ruta-ajustar"
          aria-expanded={ajustando}
          onClick={() => setAjustando((valor) => !valor)}
        >
          {ajustando ? <Check size={14} aria-hidden="true" /> : <SlidersHorizontal size={14} aria-hidden="true" />}
          {ajustando ? 'Listo' : 'Ajustar ruta'}
        </button>
      )}

      {conControles && (
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
            <span className="parada-texto">
              {pedido.horaEntrega?.slice(0, 5)} · {pedido.direccion} <EstadoBadge estado={pedido.estado} />
            </span>
            {conControles && (
              <span className="ajustes-parada">
                <button
                  type="button"
                  className="secundario pequeno"
                  aria-label={`Subir la parada del pedido ${pedido.id}`}
                  disabled={ocupado || indice === 0}
                  onClick={() => intercambiar(indice, indice - 1)}
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="secundario pequeno"
                  aria-label={`Bajar la parada del pedido ${pedido.id}`}
                  disabled={ocupado || indice === ids.length - 1}
                  onClick={() => intercambiar(indice, indice + 1)}
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="peligro pequeno"
                  aria-label={`Sacar el pedido ${pedido.id} de la ruta`}
                  disabled={ocupado}
                  onClick={() => onSacar(ruta, pedido)}
                >
                  <X size={16} aria-hidden="true" />
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
