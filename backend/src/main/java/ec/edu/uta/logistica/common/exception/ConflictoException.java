package ec.edu.uta.logistica.common.exception;

import org.springframework.http.HttpStatus;

/** 409: el estado actual del recurso no permite la operacion. */
public class ConflictoException extends ApiException {

    public ConflictoException(String mensaje) {
        this("CONFLICTO", mensaje);
    }

    public ConflictoException(String codigo, String mensaje) {
        super(HttpStatus.CONFLICT, codigo, mensaje);
    }
}
