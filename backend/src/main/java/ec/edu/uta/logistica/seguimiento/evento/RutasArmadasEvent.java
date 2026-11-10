package ec.edu.uta.logistica.seguimiento.evento;

import java.time.LocalDate;
import java.util.List;

/** Se publica cuando se arman rutas para una fecha. */
public record RutasArmadasEvent(LocalDate fecha, List<Long> rutaIds) {
}
