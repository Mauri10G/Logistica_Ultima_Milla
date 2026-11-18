package ec.edu.uta.logistica.seguridad.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Propiedades de seguridad (prefijo {@code logistica.seguridad} en application.yml).
 *
 * @param habilitada con {@code false} toda la API queda abierta (sin token); el login igual funciona
 * @param jwt        firma y vigencia de los tokens
 */
@ConfigurationProperties(prefix = "logistica.seguridad")
public record SeguridadProperties(
        @DefaultValue("false") boolean habilitada,
        @DefaultValue Jwt jwt) {

    /** Largo minimo de la clave HMAC: HS256 exige al menos 256 bits. */
    public static final int LARGO_MINIMO_SECRETO = 32;

    /**
     * @param secreto           clave HMAC-SHA256 (al menos 32 caracteres); en un despliegue real va por JWT_SECRETO
     * @param expiracionMinutos vigencia del token
     * @param emisor            claim {@code iss} de los tokens emitidos
     */
    public record Jwt(
            String secreto,
            @DefaultValue("720") long expiracionMinutos,
            @DefaultValue("logistica-ultima-milla") String emisor) {
    }
}
