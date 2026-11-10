package ec.edu.uta.logistica.common.exception;

import org.springframework.http.HttpStatus;

/** 400: la solicitud esta mal formada. */
public class SolicitudInvalidaException extends ApiException {

    public SolicitudInvalidaException(String mensaje) {
        super(HttpStatus.BAD_REQUEST, "SOLICITUD_INVALIDA", mensaje);
    }
}
