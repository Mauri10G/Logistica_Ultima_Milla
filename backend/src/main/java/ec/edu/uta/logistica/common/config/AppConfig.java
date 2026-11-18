package ec.edu.uta.logistica.common.config;

import java.time.Clock;
import java.time.ZoneId;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class AppConfig {

    private static final String ESQUEMA_BEARER = "bearer";

    /** Reloj unico de la aplicacion: permite fijar la fecha en pruebas y evita depender de la zona del servidor. */
    @Bean
    public Clock clock(LogisticaProperties propiedades) {
        return Clock.system(ZoneId.of(propiedades.zonaHoraria()));
    }

    /** Swagger UI con el boton Authorize: se pega el token de POST /api/auth/login. */
    @Bean
    public OpenAPI openApi() {
        return new OpenAPI().info(new Info()
                        .title("Sistema de Gestión de Entregas y Rutas")
                        .description("API de Logística de Última Milla - GPIS, UTA FISEI, Sexto A, Grupo D")
                        .version("v1"))
                .components(new Components().addSecuritySchemes(ESQUEMA_BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(ESQUEMA_BEARER));
    }
}
