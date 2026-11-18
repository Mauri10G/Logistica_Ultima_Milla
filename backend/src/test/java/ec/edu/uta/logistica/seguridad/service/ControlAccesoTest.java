package ec.edu.uta.logistica.seguridad.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import ec.edu.uta.logistica.common.exception.AccesoDenegadoException;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.rutas.entity.Ruta;
import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.testutil.Sesiones;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Un COURIER solo toca lo suyo; STAFF todo; sin sesion (seguridad apagada) no se restringe nada. */
class ControlAccesoTest {

    private static final LocalDate FECHA = LocalDate.of(2027, 2, 14);

    private final ControlAcceso control = new ControlAcceso();
    private final Zona centro = Fabrica.zona(1L, "Centro");

    @AfterEach
    void cerrarSesion() {
        Sesiones.cerrar();
    }

    /** Pedido asignado a una ruta del repartidor indicado. */
    private Pedido pedidoDe(long repartidorId) {
        Ruta ruta = new Ruta(FECHA, centro, Fabrica.repartidor(repartidorId, "R" + repartidorId), 4);
        Pedido pedido = Fabrica.pedido(10L, centro, FECHA);
        ruta.agregarPedido(pedido);
        return pedido;
    }

    @Test
    @DisplayName("COURIER: puede tocar un pedido de su ruta, no uno de otra ruta ni uno sin ruta (403)")
    void courierSoloSusPedidos() {
        Sesiones.comoCourier(3L);

        assertThatCode(() -> control.exigirPedidoPropio(pedidoDe(3L))).doesNotThrowAnyException();
        assertThatThrownBy(() -> control.exigirPedidoPropio(pedidoDe(4L)))
                .isInstanceOf(AccesoDenegadoException.class).hasMessageContaining("10");
        assertThatThrownBy(() -> control.exigirPedidoPropio(Fabrica.pedido(11L, centro, FECHA)))
                .isInstanceOf(AccesoDenegadoException.class);
    }

    @Test
    @DisplayName("COURIER: solo consulta su propio repartidorId")
    void courierSoloSuRepartidor() {
        Sesiones.comoCourier(3L);

        assertThatCode(() -> control.exigirRepartidorPropio(3L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> control.exigirRepartidorPropio(5L)).isInstanceOf(AccesoDenegadoException.class);
    }

    @Test
    @DisplayName("STAFF puede todo")
    void staffPuedeTodo() {
        Sesiones.comoStaff();

        assertThatCode(() -> {
            control.exigirPedidoPropio(pedidoDe(4L));
            control.exigirPedidoPropio(Fabrica.pedido(11L, centro, FECHA));
            control.exigirRepartidorPropio(5L);
        }).doesNotThrowAnyException();
        assertThat(control.usuarioActual()).get().extracting(UsuarioAutenticado::rol).isEqualTo(Rol.STAFF);
    }

    @Test
    @DisplayName("sin sesion (seguridad deshabilitada) no se restringe nada")
    void sinSesionNoRestringe() {
        assertThat(control.usuarioActual()).isEmpty();
        assertThatCode(() -> {
            control.exigirPedidoPropio(pedidoDe(4L));
            control.exigirRepartidorPropio(5L);
        }).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("el origen sale del rol e ignora el cuerpo; sin sesion se usa el cuerpo o WEB")
    void origen() {
        assertThat(control.origen(OrigenCambio.MOVIL)).isEqualTo(OrigenCambio.MOVIL);
        assertThat(control.origen(null)).isEqualTo(OrigenCambio.WEB);

        Sesiones.comoStaff();
        assertThat(control.origen(OrigenCambio.MOVIL)).isEqualTo(OrigenCambio.WEB);

        Sesiones.comoCourier(2L);
        assertThat(control.origen(OrigenCambio.WEB)).isEqualTo(OrigenCambio.MOVIL);
        assertThat(control.origen(null)).isEqualTo(OrigenCambio.MOVIL);
    }
}
