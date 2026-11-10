package ec.edu.uta.logistica.pedidos.dto;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import jakarta.validation.constraints.NotNull;

/**
 * Cuerpo de {@code PATCH /api/pedidos/{id}/estado}. La app movil envia {@code origen = MOVIL};
 * si se omite se asume WEB.
 */
public record EstadoPedidoRequest(
        @NotNull(message = "El nuevo estado es obligatorio") EstadoPedido estado,
        OrigenCambio origen) {

    public OrigenCambio origenOWeb() {
        return origen != null ? origen : OrigenCambio.WEB;
    }
}
