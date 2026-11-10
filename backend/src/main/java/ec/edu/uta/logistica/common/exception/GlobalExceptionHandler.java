package ec.edu.uta.logistica.common.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorRespuesta> manejarApi(ApiException ex) {
        return respuesta(ex.getStatus(), ex.getCodigo(), ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorRespuesta> manejarValidacion(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> errores.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return respuesta(HttpStatus.BAD_REQUEST, "VALIDACION", "Hay campos invalidos en la solicitud", errores);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorRespuesta> manejarRestricciones(ConstraintViolationException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> errores.put(v.getPropertyPath().toString(), v.getMessage()));
        return respuesta(HttpStatus.BAD_REQUEST, "VALIDACION", "Hay parametros invalidos en la solicitud", errores);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class})
    public ResponseEntity<ErrorRespuesta> manejarSolicitudMalFormada(Exception ex) {
        return respuesta(HttpStatus.BAD_REQUEST, "SOLICITUD_INVALIDA",
                "La solicitud esta mal formada o le faltan parametros", null);
    }

    /** Dos transacciones intentaron modificar el mismo registro (bloqueo optimista con @Version). */
    @ExceptionHandler({ObjectOptimisticLockingFailureException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<ErrorRespuesta> manejarConcurrencia(Exception ex) {
        LOG.warn("Conflicto de concurrencia: {}", ex.getMessage());
        return respuesta(HttpStatus.CONFLICT, "CONFLICTO_CONCURRENCIA",
                "El registro fue modificado por otra operacion. Reintente.", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorRespuesta> manejarIntegridad(DataIntegrityViolationException ex) {
        LOG.warn("Violacion de integridad: {}", ex.getMostSpecificCause().getMessage());
        return respuesta(HttpStatus.CONFLICT, "VIOLACION_INTEGRIDAD",
                "La operacion viola una restriccion de datos (duplicado o referencia invalida)", null);
    }

    /** Invariantes de dominio, por ejemplo Ruta.agregarPedido cuando se supera el maximo. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorRespuesta> manejarEstadoIlegal(IllegalStateException ex) {
        return respuesta(HttpStatus.CONFLICT, "ESTADO_ILEGAL", ex.getMessage(), null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorRespuesta> manejarGenerico(Exception ex) {
        // Los errores estandar de Spring MVC (404, 405, 415...) ya traen su estado HTTP.
        if (ex instanceof ErrorResponse er) {
            HttpStatus status = HttpStatus.valueOf(er.getStatusCode().value());
            return respuesta(status, status.name(), status.getReasonPhrase(), null);
        }
        LOG.error("Error no controlado", ex);
        return respuesta(HttpStatus.INTERNAL_SERVER_ERROR, "ERROR_INTERNO", "Ocurrio un error interno", null);
    }

    private ResponseEntity<ErrorRespuesta> respuesta(HttpStatus status, String codigo, String mensaje,
                                                     Map<String, String> errores) {
        return ResponseEntity.status(status)
                .body(new ErrorRespuesta(LocalDateTime.now(), status.value(), codigo, mensaje, errores));
    }
}
