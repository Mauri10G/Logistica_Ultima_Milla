package ec.edu.uta.logistica.rutas.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.TransicionInvalidaException;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
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

    // ---------------------------------------------------------------- ajustes manuales

    private Pedido[] llenar(int cantidad) {
        Pedido[] agregados = new Pedido[cantidad];
        for (int i = 0; i < cantidad; i++) {
            agregados[i] = Fabrica.pedido((long) i + 1, zona, FECHA);
            ruta.agregarPedido(agregados[i]);
        }
        return agregados;
    }

    @Test
    @DisplayName("quitarPedido: el pedido vuelve a PENDIENTE sin ruta y las paradas se renumeran 1, 2, ...")
    void quitaYRenumera() {
        Pedido[] p = llenar(3);

        ruta.quitarPedido(p[0]);

        assertThat(p[0].getEstado()).isEqualTo(EstadoPedido.PENDIENTE);
        assertThat(p[0].getRuta()).isNull();
        assertThat(p[0].getOrdenEnRuta()).isNull();
        assertThat(ruta.getPedidos()).containsExactly(p[1], p[2]);
        assertThat(ruta.getPedidos()).extracting(Pedido::getOrdenEnRuta).containsExactly(1, 2);
        assertThat(ruta.tieneEspacio()).isTrue();
    }

    @Test
    @DisplayName("quitarPedido: un pedido que no esta en la ruta -> 409 PEDIDO_NO_ESTA_EN_RUTA")
    void quitarPedidoAjeno() {
        llenar(1);
        Pedido ajeno = Fabrica.pedido(99L, zona, FECHA);

        assertThatThrownBy(() -> ruta.quitarPedido(ajeno)).isInstanceOf(ConflictoException.class)
                .satisfies(e -> assertThat(((ConflictoException) e).getCodigo()).isEqualTo("PEDIDO_NO_ESTA_EN_RUTA"));
    }

    @Test
    @DisplayName("reordenar: aplica el nuevo orden de visita y renumera")
    void reordena() {
        Pedido[] p = llenar(3);

        ruta.reordenar(List.of(3L, 1L, 2L));

        assertThat(ruta.getPedidos()).containsExactly(p[2], p[0], p[1]);
        assertThat(ruta.getPedidos()).extracting(Pedido::getOrdenEnRuta).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("reordenar: faltan, sobran o se repiten pedidos -> 422 ORDEN_INVALIDO y el orden no cambia")
    void reordenarInvalido() {
        Pedido[] p = llenar(3);
        List<List<Long>> invalidos = List.of(List.of(1L, 2L), List.of(1L, 2L, 3L, 4L), List.of(1L, 1L, 2L),
                List.of(1L, 2L, 9L));

        for (List<Long> orden : invalidos) {
            assertThatThrownBy(() -> ruta.reordenar(orden)).as("orden %s", orden)
                    .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("exactamente");
        }
        assertThat(ruta.getPedidos()).containsExactly(p[0], p[1], p[2]);
    }

    @Test
    @DisplayName("una ruta EN_CURSO o FINALIZADA no admite ajustes (409 RUTA_NO_MODIFICABLE)")
    void soloRutaArmadaSeAjusta() {
        Pedido[] p = llenar(2);
        ruta.iniciar();
        Repartidor otro = Fabrica.repartidor(2L, "Luis");
        List<Long> orden = List.of(2L, 1L);

        assertThatThrownBy(() -> ruta.quitarPedido(p[0])).isInstanceOf(ConflictoException.class)
                .hasMessageContaining("EN_CURSO");
        assertThatThrownBy(() -> ruta.reordenar(orden)).isInstanceOf(ConflictoException.class);
        assertThatThrownBy(() -> ruta.asignarRepartidor(otro)).isInstanceOf(ConflictoException.class);
        assertThat(ruta.getRepartidor().getNombres()).isEqualTo("Carlos");
    }

    @Test
    @DisplayName("asignarRepartidor cambia el repartidor de una ruta ARMADA")
    void cambiaRepartidor() {
        ruta.asignarRepartidor(Fabrica.repartidor(2L, "Luis"));

        assertThat(ruta.getRepartidor().getNombres()).isEqualTo("Luis");
    }

    @Test
    @DisplayName("un pedido ya RECOGIDO no se puede desasignar")
    void noDesasignaRecogido() {
        Pedido[] p = llenar(1);
        p[0].cambiarEstado(EstadoPedido.RECOGIDO);

        assertThatThrownBy(p[0]::desasignarDeRuta).isInstanceOf(ConflictoException.class)
                .hasMessageContaining("RECOGIDO");
    }
}
