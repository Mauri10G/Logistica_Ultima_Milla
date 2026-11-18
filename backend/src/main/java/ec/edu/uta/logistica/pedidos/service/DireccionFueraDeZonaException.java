package ec.edu.uta.logistica.pedidos.service;

import ec.edu.uta.logistica.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/**
 * CP-03: el punto no cae dentro de ninguna zona configurada (422). Extiende directamente de {@link ApiException} para
 * no alargar la jerarquia (Sonar java:S110).
 */
public class DireccionFueraDeZonaException extends ApiException {

    public static final String MENSAJE = "La dirección no corresponde a ninguna zona configurada";

    public DireccionFueraDeZonaException() {
        super(HttpStatus.UNPROCESSABLE_CONTENT, "DIRECCION_FUERA_DE_ZONA", MENSAJE);
    }
}
