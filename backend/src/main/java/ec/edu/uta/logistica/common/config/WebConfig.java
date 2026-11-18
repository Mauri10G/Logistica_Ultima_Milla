package ec.edu.uta.logistica.common.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS para la app web (Vite en 5173) y el emulador Android (10.0.2.2), en un solo lugar. Spring Security lo aplica
 * en su cadena de filtros ({@code cors(withDefaults())} usa este bean), asi las respuestas 401/403 y las preflight
 * {@code OPTIONS} tambien llevan las cabeceras CORS.
 */
@Configuration
public class WebConfig {

    private final LogisticaProperties propiedades;

    public WebConfig(LogisticaProperties propiedades) {
        this.propiedades = propiedades;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOriginPatterns(propiedades.cors().origenesPermitidos());
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("*"));
        cors.setExposedHeaders(List.of("X-Total-Count", "Location"));
        UrlBasedCorsConfigurationSource fuente = new UrlBasedCorsConfigurationSource();
        fuente.registerCorsConfiguration("/api/**", cors);
        return fuente;
    }
}
