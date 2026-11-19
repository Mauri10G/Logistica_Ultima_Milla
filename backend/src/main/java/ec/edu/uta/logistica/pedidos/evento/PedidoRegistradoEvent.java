package ec.edu.uta.logistica.pedidos.evento;

import java.time.LocalDate;

/**
 * Se publica dentro de la transaccion de {@code POST /api/pedidos}, recien guardado el pedido. Lo escucha el modulo de
 * rutas para insertarlo como pedido de ultimo momento si su fecha ya tiene rutas armadas.
 */
public record PedidoRegistradoEvent(Long pedidoId, LocalDate fechaEntrega, Long zonaId) {
}
