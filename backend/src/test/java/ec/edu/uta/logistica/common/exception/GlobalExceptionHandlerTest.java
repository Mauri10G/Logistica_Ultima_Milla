package ec.edu.uta.logistica.common.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.HttpRequestMethodNotSupportedException;

/** Cada tipo de error se traduce al cuerpo uniforme ErrorRespuesta con su estado y codigo. */
class GlobalExceptionHandlerTest {

    private static final Clock RELOJ = Clock.fixed(Instant.parse("2027-02-14T15:00:00Z"),
            ZoneId.of("America/Guayaquil"));

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler(RELOJ);

    private static void esperado(ResponseEntity<ErrorRespuesta> r, HttpStatus status, String codigo) {
        assertThat(r.getStatusCode()).isEqualTo(status);
        assertThat(r.getBody()).isNotNull();
        assertThat(r.getBody().codigo()).isEqualTo(codigo);
        assertThat(r.getBody().status()).isEqualTo(status.value());
    }

    @Test
    @DisplayName("la marca de tiempo sale del Clock de la aplicacion (hora de Guayaquil), no de la zona del servidor")
    void usaElClock() {
        ResponseEntity<ErrorRespuesta> r = handler.manejarApi(new ConflictoException("x"));

        assertThat(r.getBody().timestamp()).isEqualTo(LocalDateTime.of(2027, 2, 14, 10, 0));
        esperado(r, HttpStatus.CONFLICT, "CONFLICTO");
    }

    @Test
    @DisplayName("parametros invalidos (ConstraintViolation) -> 400 VALIDACION con el detalle por parametro")
    void restricciones() {
        @SuppressWarnings("unchecked")
        ConstraintViolation<Object> violacion = mock(ConstraintViolation.class);
        Path ruta = mock(Path.class);
        when(ruta.toString()).thenReturn("listar.size");
        when(violacion.getPropertyPath()).thenReturn(ruta);
        when(violacion.getMessage()).thenReturn("debe ser positivo");

        ResponseEntity<ErrorRespuesta> r = handler.manejarRestricciones(new ConstraintViolationException(Set.of(violacion)));

        esperado(r, HttpStatus.BAD_REQUEST, "VALIDACION");
        assertThat(r.getBody().errores()).containsEntry("listar.size", "debe ser positivo");
    }

    @Test
    @DisplayName("concurrencia optimista o pesimista -> 409 CONFLICTO_CONCURRENCIA")
    void concurrencia() {
        esperado(handler.manejarConcurrencia(new ObjectOptimisticLockingFailureException("Ruta", 1L)),
                HttpStatus.CONFLICT, "CONFLICTO_CONCURRENCIA");
        esperado(handler.manejarConcurrencia(new PessimisticLockingFailureException("bloqueo")),
                HttpStatus.CONFLICT, "CONFLICTO_CONCURRENCIA");
    }

    @Test
    @DisplayName("violacion de integridad -> 409 VIOLACION_INTEGRIDAD sin exponer el detalle de la BD")
    void integridad() {
        ResponseEntity<ErrorRespuesta> r = handler.manejarIntegridad(
                new DataIntegrityViolationException("duplicate key uq_pedido_ruta_orden"));

        esperado(r, HttpStatus.CONFLICT, "VIOLACION_INTEGRIDAD");
        assertThat(r.getBody().mensaje()).doesNotContain("uq_pedido_ruta_orden");
    }

    @Test
    @DisplayName("invariante de dominio (IllegalStateException) -> 409 ESTADO_ILEGAL con su mensaje")
    void estadoIlegal() {
        ResponseEntity<ErrorRespuesta> r = handler.manejarEstadoIlegal(new IllegalStateException("ruta llena"));

        esperado(r, HttpStatus.CONFLICT, "ESTADO_ILEGAL");
        assertThat(r.getBody().mensaje()).isEqualTo("ruta llena");
    }

    @Test
    @DisplayName("errores estandar de Spring MVC conservan su estado (405); el resto es 500 sin detalles internos")
    void genericos() {
        esperado(handler.manejarGenerico(new HttpRequestMethodNotSupportedException("TRACE")),
                HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED");

        ResponseEntity<ErrorRespuesta> r = handler.manejarGenerico(new RuntimeException("NullPointer en linea 42"));
        esperado(r, HttpStatus.INTERNAL_SERVER_ERROR, "ERROR_INTERNO");
        assertThat(r.getBody().mensaje()).doesNotContain("linea 42");
    }
}
