package ec.edu.uta.logistica.seguimiento.evento;

import java.time.LocalDate;

/** Una ruta cambio: recibio un pedido de ultimo momento o cambio de estado (ARMADA, EN_CURSO, FINALIZADA). */
public record RutaActualizadaEvent(Long rutaId, LocalDate fecha, String estado, String motivo) {
}
