package ec.edu.uta.logistica.pedidos.entity;

import java.util.Optional;

/**
 * Estados del pedido. El flujo es lineal: PENDIENTE -> ASIGNADO -> RECOGIDO -> EN_CAMINO -> ENTREGADO.
 * Cualquier otra transicion es invalida y lanza {@link TransicionInvalidaException}.
 */
public enum EstadoPedido {
    PENDIENTE,
    ASIGNADO,
    RECOGIDO,
    EN_CAMINO,
    ENTREGADO;

    public Optional<EstadoPedido> siguiente() {
        EstadoPedido[] todos = values();
        return ordinal() + 1 < todos.length ? Optional.of(todos[ordinal() + 1]) : Optional.empty();
    }

    public boolean puedeTransicionarA(EstadoPedido destino) {
        return siguiente().filter(s -> s == destino).isPresent();
    }

    public void validarTransicionA(EstadoPedido destino) {
        if (!puedeTransicionarA(destino)) {
            throw new TransicionInvalidaException(this, destino);
        }
    }
}
