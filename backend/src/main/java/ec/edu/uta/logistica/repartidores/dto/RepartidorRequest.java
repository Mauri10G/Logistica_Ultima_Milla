package ec.edu.uta.logistica.repartidores.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RepartidorRequest(
        @NotBlank(message = "Los nombres son obligatorios")
        @Size(max = 150, message = "Los nombres admiten hasta 150 caracteres")
        String nombres,
        @NotBlank(message = "El telefono es obligatorio")
        @Size(max = 30, message = "El telefono admite hasta 30 caracteres")
        String telefono,
        @Min(value = 1, message = "La capacidad minima es 1")
        Integer capacidadMaxima,
        Boolean disponible) {
}
