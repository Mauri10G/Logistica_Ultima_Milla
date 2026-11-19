package ec.edu.uta.logistica.seguridad.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.time.Clock;

import ec.edu.uta.logistica.seguridad.config.SeguridadConfig;
import ec.edu.uta.logistica.seguridad.config.SeguridadProperties;
import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import ec.edu.uta.logistica.seguridad.service.TokenService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;

/** CONNECT de STOMP en /ws: sin token valido no se conecta (con la seguridad encendida). */
class AutenticacionStompInterceptorTest {

    private static final SeguridadProperties.Jwt JWT =
            new SeguridadProperties.Jwt("clave-de-pruebas-unitarias-de-32-bytes-o-mas", 60, "logistica-test");

    private final SeguridadConfig config = new SeguridadConfig();
    private final MessageChannel canal = mock(MessageChannel.class);

    private AutenticacionStompInterceptor interceptor(boolean habilitada) {
        SeguridadProperties propiedades = new SeguridadProperties(habilitada, JWT);
        return new AutenticacionStompInterceptor(propiedades, config.jwtDecoder(propiedades),
                config.jwtAuthenticationConverter());
    }

    private String emitirToken() {
        SeguridadProperties propiedades = new SeguridadProperties(true, JWT);
        return new TokenService(config.jwtEncoder(propiedades), propiedades, Clock.systemUTC())
                .emitir(new Usuario("diego", "x", Rol.COURIER, 4L)).token();
    }

    private static Message<byte[]> frame(StompCommand comando, String authorization) {
        StompHeaderAccessor accesor = StompHeaderAccessor.create(comando);
        if (authorization != null) {
            accesor.addNativeHeader("Authorization", authorization);
        }
        accesor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accesor.getMessageHeaders());
    }

    @Test
    @DisplayName("CONNECT con un token valido: se acepta y la conexion queda a nombre del usuario")
    void tokenValido() {
        Message<?> resultado = interceptor(true).preSend(frame(StompCommand.CONNECT, "Bearer " + emitirToken()), canal);

        StompHeaderAccessor accesor = MessageHeaderAccessor.getAccessor(resultado, StompHeaderAccessor.class);
        assertThat(accesor.getUser()).isNotNull();
        assertThat(accesor.getUser().getName()).isEqualTo("diego");
    }

    @Test
    @DisplayName("CONNECT sin token, con otro esquema o con un token invalido: se rechaza")
    void sinTokenOInvalido() {
        AutenticacionStompInterceptor interceptor = interceptor(true);

        var mensaje = frame(StompCommand.CONNECT, null);
        assertThatThrownBy(() -> interceptor.preSend(mensaje, canal))
                .isInstanceOf(MessageDeliveryException.class).hasMessageContaining("Falta el token");
        var mensaje2 = frame(StompCommand.CONNECT, "Basic abc");
        assertThatThrownBy(() -> interceptor.preSend(mensaje2, canal))
                .isInstanceOf(MessageDeliveryException.class);
        var mensaje3 = frame(StompCommand.CONNECT, "Bearer no.es.jwt");
        assertThatThrownBy(() -> interceptor.preSend(mensaje3, canal))
                .isInstanceOf(MessageDeliveryException.class).hasMessageContaining("invalido");
    }

    @Test
    @DisplayName("otros frames (SUBSCRIBE, SEND) no se revisan: la sesion ya se valido en el CONNECT")
    void otrosFramesPasan() {
        Message<byte[]> suscripcion = frame(StompCommand.SUBSCRIBE, null);

        assertThat(interceptor(true).preSend(suscripcion, canal)).isSameAs(suscripcion);
    }

    @Test
    @DisplayName("con la seguridad deshabilitada el CONNECT sin token se acepta")
    void seguridadDeshabilitada() {
        Message<byte[]> conexion = frame(StompCommand.CONNECT, null);

        assertThat(interceptor(false).preSend(conexion, canal)).isSameAs(conexion);
    }
}
