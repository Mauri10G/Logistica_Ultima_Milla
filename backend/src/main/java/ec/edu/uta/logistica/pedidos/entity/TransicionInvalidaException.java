package ec.edu.uta.logistica.pedidos.entity;

import ec.edu.uta.logistica.common.exception.ConflictoException;

public class TransicionInvalidaException extends ConflictoException {

    public TransicionInvalidaException(EstadoPedido origen, EstadoPedido destino) {
        super("TRANSICION_INVALIDA", "Transicion de estado invalida: " + origen + " -> " + destino);
    }
}
