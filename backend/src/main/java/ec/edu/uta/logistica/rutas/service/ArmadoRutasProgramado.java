package ec.edu.uta.logistica.rutas.service;

import java.time.Clock;
import java.time.LocalDate;

import ec.edu.uta.logistica.common.config.LogisticaProperties;
import ec.edu.uta.logistica.common.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Armado automatico de rutas con @Scheduled. Por defecto corre todos los dias a las 18:00 (hora de
 * {@code logistica.zona-horaria}) y arma las rutas del dia siguiente. Se configura en application.yml:
 * {@code logistica.rutas.armado.programado-habilitado}, {@code .cron} y {@code .dias-adelante}.
 */
@Component
@ConditionalOnProperty(name = "logistica.rutas.armado.programado-habilitado", havingValue = "true",
        matchIfMissing = true)
public class ArmadoRutasProgramado {

    private static final Logger LOG = LoggerFactory.getLogger(ArmadoRutasProgramado.class);

    private final ArmadoRutasService armadoRutasService;
    private final LogisticaProperties propiedades;
    private final Clock reloj;

    public ArmadoRutasProgramado(ArmadoRutasService armadoRutasService, LogisticaProperties propiedades, Clock reloj) {
        this.armadoRutasService = armadoRutasService;
        this.propiedades = propiedades;
        this.reloj = reloj;
    }

    @Scheduled(cron = "${logistica.rutas.armado.cron:0 0 18 * * *}",
            zone = "${logistica.zona-horaria:America/Guayaquil}")
    public void armarRutasProgramado() {
        LocalDate fecha = LocalDate.now(reloj).plusDays(propiedades.rutas().armado().diasAdelante());
        LOG.info("Armado programado de rutas para {}", fecha);
        try {
            int rutas = armadoRutasService.armar(fecha).size();
            LOG.info("Armado programado terminado: {} rutas creadas para {}", rutas, fecha);
        } catch (ApiException e) {
            LOG.warn("Armado programado de {} no realizado: {}", fecha, e.getMessage());
        } catch (RuntimeException e) {
            LOG.error("Fallo el armado programado de {}", fecha, e);
        }
    }
}
