package ec.edu.uta.logistica.pedidos.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class EstadoPedidoTest {

    static Stream<Arguments> todosLosPares() {
        Stream.Builder<Arguments> pares = Stream.builder();
        for (EstadoPedido origen : EstadoPedido.values()) {
            for (EstadoPedido destino : EstadoPedido.values()) {
                pares.add(Arguments.of(origen, destino, destino.ordinal() == origen.ordinal() + 1));
            }
        }
        return pares.build();
    }

    @ParameterizedTest(name = "{0} -> {1} valida: {2}")
    @MethodSource("todosLosPares")
    void soloSePuedeAvanzarAlSiguienteEstado(EstadoPedido origen, EstadoPedido destino, boolean valida) {
        assertThat(origen.puedeTransicionarA(destino)).isEqualTo(valida);
        if (valida) {
            assertThatCode(() -> origen.validarTransicionA(destino)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> origen.validarTransicionA(destino))
                    .isInstanceOf(TransicionInvalidaException.class)
                    .hasMessageContaining(origen + " -> " + destino);
        }
    }

    @Test
    void elFlujoCompletoEsPendienteAsignadoRecogidoEnCaminoEntregado() {
        assertThat(EstadoPedido.values()).containsExactly(EstadoPedido.PENDIENTE, EstadoPedido.ASIGNADO,
                EstadoPedido.RECOGIDO, EstadoPedido.EN_CAMINO, EstadoPedido.ENTREGADO);
        assertThat(EstadoPedido.ENTREGADO.siguiente()).isEmpty();
    }
}
