package ec.edu.uta.logistica.rutas.dto;

import jakarta.validation.constraints.NotNull;

/** Cuerpo de {@code PATCH /api/rutas/{id}/repartidor}. */
public record CambioRepartidorRequest(@NotNull(message = "El repartidor es obligatorio") Long repartidorId) {
}
