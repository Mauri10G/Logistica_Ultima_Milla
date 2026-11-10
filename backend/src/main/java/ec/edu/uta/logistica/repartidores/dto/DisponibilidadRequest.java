package ec.edu.uta.logistica.repartidores.dto;

import jakarta.validation.constraints.NotNull;

public record DisponibilidadRequest(@NotNull(message = "Indique si el repartidor esta disponible") Boolean disponible) {
}
