package ec.edu.uta.logistica.common.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Propiedades propias del sistema (prefijo {@code logistica} en application.yml).
 */
@ConfigurationProperties(prefix = "logistica")
public record LogisticaProperties(
        @DefaultValue("America/Guayaquil") String zonaHoraria,
        @DefaultValue Rutas rutas,
        @DefaultValue Cors cors) {

    /**
     * @param maxPedidos maximo de pedidos por ruta (por defecto 4)
     * @param armado     configuracion del armado programado con @Scheduled
     */
    public record Rutas(
            @DefaultValue("4") int maxPedidos,
            @DefaultValue Armado armado) {
    }

    /**
     * @param programadoHabilitado activa/desactiva el armado automatico
     * @param cron                 expresion cron de Spring (6 campos)
     * @param diasAdelante         para que fecha de entrega arma rutas (1 = manana)
     */
    public record Armado(
            @DefaultValue("true") boolean programadoHabilitado,
            @DefaultValue("0 0 18 * * *") String cron,
            @DefaultValue("1") int diasAdelante) {
    }

    public record Cors(
            @DefaultValue({"http://localhost:5173", "http://localhost:*", "http://127.0.0.1:*", "http://10.0.2.2:*"})
            List<String> origenesPermitidos) {
    }
}
