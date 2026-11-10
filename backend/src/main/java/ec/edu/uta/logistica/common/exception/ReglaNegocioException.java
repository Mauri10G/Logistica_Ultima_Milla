package ec.edu.uta.logistica.common.exception;

import org.springframework.http.HttpStatus;

/** 422: la solicitud es sintacticamente valida pero incumple una regla de negocio. */
public class ReglaNegocioException extends ApiException {

    public ReglaNegocioException(String mensaje) {
        this("REGLA_NEGOCIO", mensaje);
    }

    public ReglaNegocioException(String codigo, String mensaje) {
        super(HttpStatus.UNPROCESSABLE_CONTENT, codigo, mensaje);
    }
}
