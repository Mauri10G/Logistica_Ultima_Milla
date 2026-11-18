package ec.edu.uta.logistica.seguridad.websocket;

import ec.edu.uta.logistica.seguridad.config.SeguridadProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.stereotype.Component;

/**
 * Protege el {@code CONNECT} de STOMP en {@code /ws}: el token va en la cabecera {@code Authorization} del frame
 * (los navegadores no permiten cabeceras propias en el handshake HTTP del WebSocket). Sin token valido el cliente
 * recibe un frame ERROR y la conexion se cierra. Con la seguridad deshabilitada no se exige nada.
 */
@Component
public class AutenticacionStompInterceptor implements ChannelInterceptor {

    private static final String PREFIJO_BEARER = "Bearer ";

    private final SeguridadProperties propiedades;
    private final JwtDecoder decodificador;
    private final JwtAuthenticationConverter conversor;

    public AutenticacionStompInterceptor(SeguridadProperties propiedades, JwtDecoder decodificador,
                                         JwtAuthenticationConverter conversor) {
        this.propiedades = propiedades;
        this.decodificador = decodificador;
        this.conversor = conversor;
    }

    @Override
    public Message<?> preSend(Message<?> mensaje, MessageChannel canal) {
        StompHeaderAccessor accesor = MessageHeaderAccessor.getAccessor(mensaje, StompHeaderAccessor.class);
        if (!propiedades.habilitada() || accesor == null || !StompCommand.CONNECT.equals(accesor.getCommand())) {
            return mensaje;
        }
        String cabecera = accesor.getFirstNativeHeader(HttpHeaders.AUTHORIZATION);
        if (cabecera == null || !cabecera.regionMatches(true, 0, PREFIJO_BEARER, 0, PREFIJO_BEARER.length())) {
            throw new MessageDeliveryException(mensaje, "Falta el token: envie Authorization: Bearer <token> en CONNECT");
        }
        try {
            accesor.setUser(conversor.convert(decodificador.decode(cabecera.substring(PREFIJO_BEARER.length()).trim())));
        } catch (JwtException e) {
            throw new MessageDeliveryException(mensaje, "Token invalido o vencido");
        }
        return mensaje;
    }
}
