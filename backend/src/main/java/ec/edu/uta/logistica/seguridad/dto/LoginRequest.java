package ec.edu.uta.logistica.seguridad.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cuerpo de {@code POST /api/auth/login}. */
public record LoginRequest(
        @NotBlank(message = "El usuario es obligatorio")
        @Size(max = 50, message = "El usuario admite hasta 50 caracteres")
        String usuario,
        @NotBlank(message = "La clave es obligatoria")
        @Size(max = 100, message = "La clave admite hasta 100 caracteres")
        String clave) {

    /** Evita que la clave termine en un log por accidente. */
    @Override
    public String toString() {
        return "LoginRequest[usuario=" + usuario + ", clave=***]";
    }
}
