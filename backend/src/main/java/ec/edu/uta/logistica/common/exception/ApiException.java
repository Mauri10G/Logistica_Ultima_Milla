package ec.edu.uta.logistica.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Base de las excepciones de negocio. Cada una declara el estado HTTP y un codigo estable
 * que la web y la app movil pueden usar para decidir que mostrar.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String codigo;

    public ApiException(HttpStatus status, String codigo, String mensaje) {
        super(mensaje);
        this.status = status;
        this.codigo = codigo;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCodigo() {
        return codigo;
    }
}
