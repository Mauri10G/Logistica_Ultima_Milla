package ec.edu.uta.logistica.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS para la app web (Vite en 5173) y el emulador Android (10.0.2.2).
 * Aun no hay autenticacion: cuando se agregue Spring Security, esta clase es el sitio
 * natural para integrar la configuracion de CORS con la cadena de filtros.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final LogisticaProperties propiedades;

    public WebConfig(LogisticaProperties propiedades) {
        this.propiedades = propiedades;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(propiedades.cors().origenesPermitidos().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("X-Total-Count", "Location");
    }
}
