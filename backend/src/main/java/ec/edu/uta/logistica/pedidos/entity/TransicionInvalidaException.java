package ec.edu.uta.logistica.pedidos.entity;

import ec.edu.uta.logistica.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/**
 * 409 TRANSICION_INVALIDA: el pedido solo avanza al siguiente estado. Extiende directamente de {@link ApiException}
 * (con el estado HTTP como dato) para no alargar la jerarquia (Sonar java:S110).
 */
public class TransicionInvalidaException extends ApiException {

    public TransicionInvalidaException(EstadoPedido origen, EstadoPedido destino) {
        super(HttpStatus.CONFLICT, "TRANSICION_INVALIDA", "Transicion de estado invalida: " + origen + " -> " + destino);
    }
}
