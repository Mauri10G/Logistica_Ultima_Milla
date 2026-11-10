package ec.edu.uta.logistica.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket + STOMP.
 * <ul>
 *   <li>Endpoint: {@code ws://host:8080/ws} (WebSocket nativo, sin SockJS: lo usan @stomp/stompjs y stomp_dart_client)</li>
 *   <li>Topicos: {@code /topic/pedidos} (cambios de estado) y {@code /topic/rutas} (rutas armadas/actualizadas)</li>
 * </ul>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final LogisticaProperties propiedades;

    public WebSocketConfig(LogisticaProperties propiedades) {
        this.propiedades = propiedades;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(propiedades.cors().origenesPermitidos().toArray(String[]::new));
    }
}
