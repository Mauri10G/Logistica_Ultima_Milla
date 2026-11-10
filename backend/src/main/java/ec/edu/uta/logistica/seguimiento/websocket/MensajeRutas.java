package ec.edu.uta.logistica.seguimiento.websocket;

import java.time.LocalDate;
import java.util.List;

/**
 * Mensaje de {@code /topic/rutas}.
 *
 * @param tipo RUTAS_ARMADAS o RUTA_ACTUALIZADA
 */
public record MensajeRutas(String tipo, LocalDate fecha, List<Long> rutaIds, String estado, String motivo) {
}
