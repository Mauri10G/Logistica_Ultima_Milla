package ec.edu.uta.logistica.seguridad.config;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;

import ec.edu.uta.logistica.common.exception.AccesoDenegadoException;
import ec.edu.uta.logistica.common.exception.ErrorRespuesta;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Los 401 y 403 que decide la cadena de filtros de Spring Security (antes de llegar a los controladores) se
 * responden con el mismo cuerpo {@link ErrorRespuesta} que el resto de la API.
 */
@Component
public class RespuestaErrorSeguridad implements AuthenticationEntryPoint, AccessDeniedHandler {

    public static final String CODIGO_NO_AUTENTICADO = "NO_AUTENTICADO";

    private final ObjectMapper json;
    private final Clock reloj;

    public RespuestaErrorSeguridad(ObjectMapper json, Clock reloj) {
        this.json = json;
        this.reloj = reloj;
    }

    /** 401: sin token, token mal formado, vencido o con firma invalida. */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException ex) throws IOException {
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        escribir(response, HttpStatus.UNAUTHORIZED, CODIGO_NO_AUTENTICADO,
                "Debe iniciar sesion: falta el token o no es valido");
    }

    /** 403: el rol del token no tiene permiso para este endpoint. */
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException ex) throws IOException {
        escribir(response, HttpStatus.FORBIDDEN, AccesoDenegadoException.CODIGO,
                "Su rol no tiene permiso para esta operacion");
    }

    private void escribir(HttpServletResponse response, HttpStatus status, String codigo, String mensaje)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getOutputStream(),
                new ErrorRespuesta(LocalDateTime.now(reloj), status.value(), codigo, mensaje, null));
    }
}
