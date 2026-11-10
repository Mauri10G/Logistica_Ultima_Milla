package ec.edu.uta.logistica.pedidos.service;

import ec.edu.uta.logistica.common.exception.ReglaNegocioException;

/** CP-03: el punto no cae dentro de ninguna zona configurada (422). */
public class DireccionFueraDeZonaException extends ReglaNegocioException {

    public static final String MENSAJE = "La dirección no corresponde a ninguna zona configurada";

    public DireccionFueraDeZonaException() {
        super("DIRECCION_FUERA_DE_ZONA", MENSAJE);
    }
}
