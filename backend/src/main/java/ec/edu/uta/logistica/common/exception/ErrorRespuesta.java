package ec.edu.uta.logistica.common.exception;

import java.time.LocalDateTime;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Cuerpo uniforme de todos los errores de la API.
 *
 * @param errores errores por campo (solo en validaciones de Bean Validation)
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ErrorRespuesta(
        LocalDateTime timestamp,
        int status,
        String codigo,
        String mensaje,
        Map<String, String> errores) {
}
