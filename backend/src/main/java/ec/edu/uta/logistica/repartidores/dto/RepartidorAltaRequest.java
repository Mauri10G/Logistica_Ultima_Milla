package ec.edu.uta.logistica.repartidores.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Cuerpo de {@code POST /api/repartidores}: los datos del repartidor y las credenciales con las que entra a la app
 * movil. Editar ({@code PUT}) sigue usando {@link RepartidorRequest}, que no lleva usuario ni clave.
 */
public record RepartidorAltaRequest(
        @NotBlank(message = "Los nombres son obligatorios")
        @Size(max = 150, message = "Los nombres admiten hasta 150 caracteres")
        String nombres,
        @NotBlank(message = "El telefono es obligatorio")
        @Size(max = 30, message = "El telefono admite hasta 30 caracteres")
        String telefono,
        @Min(value = 1, message = "La capacidad minima es 1")
        Integer capacidadMaxima,
        Boolean disponible,
        @NotBlank(message = "El usuario es obligatorio")
        @Size(min = 3, max = 50, message = "El usuario debe tener entre 3 y 50 caracteres")
        @Pattern(regexp = "[a-z0-9._]*",
                message = "El usuario solo admite letras minusculas, numeros, punto o guion bajo")
        String usuario,
        @NotBlank(message = "La clave es obligatoria")
        @Size(min = 6, max = 72, message = "La clave debe tener entre 6 y 72 caracteres")
        String clave) {

    /** Evita que la clave termine en un log por accidente. */
    @Override
    public String toString() {
        return "RepartidorAltaRequest[nombres=" + nombres + ", telefono=" + telefono + ", usuario=" + usuario
                + ", clave=***]";
    }
}
