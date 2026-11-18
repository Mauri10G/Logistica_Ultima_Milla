package ec.edu.uta.logistica.pedidos.dto;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import jakarta.validation.constraints.NotNull;

/**
 * Cuerpo de {@code PATCH /api/pedidos/{id}/estado}.
 *
 * @param origen solo se usa con la seguridad deshabilitada (sin token). Con sesion el origen sale del rol
 *               (STAFF = WEB, COURIER = MOVIL) y este campo se ignora. Se mantiene para no romper a los clientes que
 *               aun lo envian.
 */
public record EstadoPedidoRequest(
        @NotNull(message = "El nuevo estado es obligatorio") EstadoPedido estado,
        OrigenCambio origen) {
}
