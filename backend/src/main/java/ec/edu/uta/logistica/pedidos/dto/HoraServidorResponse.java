package ec.edu.uta.logistica.pedidos.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Respuesta de {@code GET /api/servidor/hora}: la hora del servidor en su zona horaria, la anticipacion minima de una
 * entrega y la primera fecha y hora de entrega aceptadas. No incluye datos sensibles.
 *
 * @param fecha                     fecha actual del servidor
 * @param hora                      hora actual del servidor (HH:mm, sin segundos)
 * @param zonaHoraria               identificador de la zona horaria, p. ej. America/Guayaquil
 * @param anticipacionMinimaMinutos minutos minimos entre ahora y la hora de entrega
 * @param entregaMinimaFecha        fecha de la primera entrega aceptada (ahora + anticipacion; puede ser manana)
 * @param entregaMinimaHora         hora de la primera entrega aceptada
 */
public record HoraServidorResponse(
        LocalDate fecha,
        LocalTime hora,
        String zonaHoraria,
        int anticipacionMinimaMinutos,
        LocalDate entregaMinimaFecha,
        LocalTime entregaMinimaHora) {
}
