package ec.edu.uta.logistica.rutas.service;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.rutas.entity.Ruta;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exclusion mutua por (zona, fecha) para el armado y la insercion de ultimo momento.
 *
 * <ol>
 *   <li><b>pg_advisory_xact_lock(zona, fecha)</b>: serializa a quienes planifican la misma zona y fecha, incluso
 *       cuando todavia no existe ninguna ruta (SELECT ... FOR UPDATE no bloquea filas que aun no existen, y dos
 *       transacciones crearian rutas duplicadas). Se libera solo al terminar la transaccion.</li>
 *   <li><b>PESSIMISTIC_WRITE</b> sobre las rutas existentes: bloquea las filas que se van a modificar y
 *       garantiza que se lea el estado ya confirmado por quien tenia el bloqueo antes.</li>
 * </ol>
 *
 * Quien necesite varias zonas debe bloquearlas SIEMPRE en orden ascendente de id para evitar interbloqueos.
 */
@Component
public class BloqueoZonaFecha {

    private final JdbcTemplate jdbc;
    private final RutaRepository rutaRepository;

    public BloqueoZonaFecha(JdbcTemplate jdbc, RutaRepository rutaRepository) {
        this.jdbc = jdbc;
        this.rutaRepository = rutaRepository;
    }

    /** Debe llamarse dentro de una transaccion activa. Devuelve las rutas de esa zona y fecha ya bloqueadas. */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<Ruta> bloquear(Long zonaId, LocalDate fecha) {
        int clave1 = Math.toIntExact(zonaId);
        int clave2 = Math.toIntExact(fecha.toEpochDay());
        jdbc.execute((ConnectionCallback<Void>) conexion -> {
            try (var sentencia = conexion.prepareStatement("select pg_advisory_xact_lock(?, ?)")) {
                sentencia.setInt(1, clave1);
                sentencia.setInt(2, clave2);
                sentencia.execute();
            }
            return null;
        });
        return rutaRepository.bloquearPorZonaYFecha(zonaId, fecha);
    }
}
