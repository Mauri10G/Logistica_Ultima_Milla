package ec.edu.uta.logistica.rutas.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * Cuerpo de {@code PUT /api/rutas/{id}/orden}.
 *
 * @param pedidos ids de los pedidos de la ruta en el nuevo orden de visita, por ejemplo {@code [12, 7, 9]}
 */
public record OrdenRutaRequest(
        @NotEmpty(message = "Indique el nuevo orden de los pedidos")
        List<@NotNull(message = "Los ids de pedido no pueden ser nulos") Long> pedidos) {
}
