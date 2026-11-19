package ec.edu.uta.logistica.common.exception;

import org.springframework.http.HttpStatus;

/** 401: no hay sesion valida (credenciales incorrectas, token ausente, vencido o con firma invalida). */
public class NoAutenticadoException extends ApiException {

    public NoAutenticadoException(String codigo, String mensaje) {
        super(HttpStatus.UNAUTHORIZED, codigo, mensaje);
    }
}
