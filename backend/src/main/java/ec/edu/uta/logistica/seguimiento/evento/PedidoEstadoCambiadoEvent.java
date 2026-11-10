package ec.edu.uta.logistica.seguimiento.evento;

import java.time.LocalDateTime;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;

/**
 * Evento de dominio y, a la vez, el mensaje que se publica en {@code /topic/pedidos}.
 * La web actualiza su tabla de seguimiento usando {@code pedidoId} y {@code estadoNuevo}.
 */
public record PedidoEstadoCambiadoEvent(
        Long pedidoId,
        EstadoPedido estadoAnterior,
        EstadoPedido estadoNuevo,
        OrigenCambio origen,
        LocalDateTime fechaCambio) {
}
