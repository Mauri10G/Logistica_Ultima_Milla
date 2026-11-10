package ec.edu.uta.logistica.rutas.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.TransicionInvalidaException;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** CP-09: una ruta no puede superar su maximo de pedidos. */
class RutaTest {

    private static final LocalDate FECHA = LocalDate.of(2027, 2, 14);

    private Zona zona;
    private Ruta ruta;

    @BeforeEach
    void preparar() {
        zona = Fabrica.zona(1L, "Centro");
        ruta = new Ruta(FECHA, zona, Fabrica.repartidor(1L, "Carlos"), 4);
    }

    @Test
    @DisplayName("agregarPedido acepta hasta 4 pedidos y numera el orden de visita")
    void aceptaHastaElMaximo() {
        for (long id = 1; id <= 4; id++) {
            ruta.agregarPedido(Fabrica.pedido(id, zona, FECHA));
        }

        assertThat(ruta.getPedidos()).hasSize(4);
        assertThat(ruta.getPedidos()).extracting(Pedido::getOrdenEnRuta).containsExactly(1, 2, 3, 4);
        assertThat(ruta.getPedidos()).allMatch(p -> p.getEstado() == EstadoPedido.ASIGNADO);
        assertThat(ruta.tieneEspacio()).isFalse();
    }

    @Test
    @DisplayName("agregarPedido lanza IllegalStateException al superar el maximo de 4")
    void rechazaElQuintoPedido() {
        for (long id = 1; id <= 4; id++) {
            ruta.agregarPedido(Fabrica.pedido(id, zona, FECHA));
        }
        Pedido quinto = Fabrica.pedido(5L, zona, FECHA);

        assertThatThrownBy(() -> ruta.agregarPedido(quinto))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("4");

        assertThat(ruta.getPedidos()).hasSize(4);
        assertThat(quinto.getEstado()).isEqualTo(EstadoPedido.PENDIENTE);
        assertThat(quinto.getRuta()).isNull();
    }

    @Test
    @DisplayName("el maximo es configurable por ruta")
    void respetaUnMaximoDistinto() {
        Ruta pequena = new Ruta(FECHA, zona, Fabrica.repartidor(2L, "Luis"), 2);
        pequena.agregarPedido(Fabrica.pedido(1L, zona, FECHA));
        pequena.agregarPedido(Fabrica.pedido(2L, zona, FECHA));

        assertThatThrownBy(() -> pequena.agregarPedido(Fabrica.pedido(3L, zona, FECHA)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("un pedido que ya no esta PENDIENTE no se puede asignar otra vez")
    void rechazaPedidoYaAsignado() {
        Pedido pedido = Fabrica.pedido(1L, zona, FECHA);
        ruta.agregarPedido(pedido);
        Ruta otra = new Ruta(FECHA, zona, Fabrica.repartidor(2L, "Luis"), 4);

        assertThatThrownBy(() -> otra.agregarPedido(pedido)).isInstanceOf(TransicionInvalidaException.class);
        assertThat(otra.getPedidos()).isEmpty();
    }

    @Test
    @DisplayName("un pedido de otra fecha no entra en la ruta")
    void rechazaPedidoDeOtraFecha() {
        Pedido otroDia = Fabrica.pedido(1L, zona, FECHA.plusDays(1));

        assertThatThrownBy(() -> ruta.agregarPedido(otroDia)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("la ruta pasa a FINALIZADA solo cuando todos sus pedidos estan ENTREGADO")
    void detectaRutaEntregada() {
        Pedido a = Fabrica.pedido(1L, zona, FECHA);
        Pedido b = Fabrica.pedido(2L, zona, FECHA);
        ruta.agregarPedido(a);
        ruta.agregarPedido(b);

        for (Pedido p : new Pedido[]{a, b}) {
            p.cambiarEstado(EstadoPedido.RECOGIDO);
            p.cambiarEstado(EstadoPedido.EN_CAMINO);
        }
        a.cambiarEstado(EstadoPedido.ENTREGADO);
        assertThat(ruta.todosEntregados()).isFalse();

        b.cambiarEstado(EstadoPedido.ENTREGADO);
        assertThat(ruta.todosEntregados()).isTrue();
    }

    @Test
    @DisplayName("no se crea una ruta con maximo menor a 1")
    void validaMaximo() {
        assertThatThrownBy(() -> new Ruta(FECHA, zona, Fabrica.repartidor(1L, "Carlos"), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
