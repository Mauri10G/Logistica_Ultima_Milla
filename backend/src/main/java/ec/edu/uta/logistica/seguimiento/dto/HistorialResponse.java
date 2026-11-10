package ec.edu.uta.logistica.seguimiento.dto;

import java.time.LocalDateTime;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.seguimiento.entity.HistorialEstadoPedido;

public record HistorialResponse(Long id, Long pedidoId, EstadoPedido estadoAnterior, EstadoPedido estadoNuevo,
                                LocalDateTime fechaCambio, OrigenCambio origen) {

    public static HistorialResponse desde(HistorialEstadoPedido h) {
        return new HistorialResponse(h.getId(), h.getPedidoId(), h.getEstadoAnterior(), h.getEstadoNuevo(),
                h.getFechaCambio(), h.getOrigen());
    }
}
