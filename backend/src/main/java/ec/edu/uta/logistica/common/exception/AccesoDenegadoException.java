package ec.edu.uta.logistica.common.exception;

import org.springframework.http.HttpStatus;

/** 403: hay sesion, pero el rol no tiene permiso o el recurso no le pertenece (un COURIER y una ruta ajena). */
public class AccesoDenegadoException extends ApiException {

    public static final String CODIGO = "ACCESO_DENEGADO";

    public AccesoDenegadoException(String mensaje) {
        super(HttpStatus.FORBIDDEN, CODIGO, mensaje);
    }
}
