package ec.edu.uta.logistica.rutas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.ApiException;
import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.entity.Ruta;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import ec.edu.uta.logistica.seguimiento.evento.RutaActualizadaEvent;
import ec.edu.uta.logistica.seguimiento.service.SeguimientoService;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

/** Ajustes manuales: reglas, bloqueos en orden, historial y eventos de /topic/rutas. La BD es un mock. */
@ExtendWith(MockitoExtension.class)
class AjusteRutasServiceTest {

    private static final LocalDate FECHA = LocalDate.of(2027, 2, 14);

    @Mock
    private RutaRepository rutaRepository;
    @Mock
    private PedidoRepository pedidoRepository;
    @Mock
    private RepartidorRepository repartidorRepository;
    @Mock
    private BloqueoZonaFecha bloqueo;
    @Mock
    private SeguimientoService seguimientoService;
    @Mock
    private ApplicationEventPublisher publicador;
    @Mock
    private EntityManager entityManager;

    private AjusteRutasService servicio;
    private final Zona centro = Fabrica.zona(1L, "Centro");
    private final Zona norte = Fabrica.zona(2L, "Norte");

    @BeforeEach
    void preparar() {
        servicio = new AjusteRutasService(rutaRepository, pedidoRepository, repartidorRepository, bloqueo,
                seguimientoService, publicador, entityManager);
    }

    private Ruta ruta(long id, Zona zona, int maximo, long... pedidoIds) {
        Ruta ruta = new Ruta(FECHA, zona, Fabrica.repartidor(1L, "Carlos"), maximo);
        ReflectionTestUtils.setField(ruta, "id", id);
        for (long pedidoId : pedidoIds) {
            ruta.agregarPedido(Fabrica.pedido(pedidoId, zona, FECHA));
        }
        when(rutaRepository.findById(id)).thenReturn(Optional.of(ruta));
        return ruta;
    }

    private Pedido pedidoPendiente(long id, Zona zona) {
        Pedido pedido = Fabrica.pedido(id, zona, FECHA);
        when(pedidoRepository.findById(id)).thenReturn(Optional.of(pedido));
        return pedido;
    }

    private List<RutaActualizadaEvent> eventos(int cantidad) {
        ArgumentCaptor<RutaActualizadaEvent> captor = ArgumentCaptor.forClass(RutaActualizadaEvent.class);
        verify(publicador, times(cantidad)).publishEvent(captor.capture());
        return captor.getAllValues();
    }

    // ---------------------------------------------------------------- cambiar repartidor

    @Test
    @DisplayName("cambiar repartidor: bloquea la zona, asigna al nuevo y publica REPARTIDOR_CAMBIADO")
    void cambiaRepartidor() {
        ruta(10L, centro, 4, 1L);
        Repartidor luis = Fabrica.repartidor(2L, "Luis");
        when(repartidorRepository.findById(2L)).thenReturn(Optional.of(luis));

        RutaResponse respuesta = servicio.cambiarRepartidor(10L, 2L);

        assertThat(respuesta.repartidorNombre()).isEqualTo("Luis");
        verify(bloqueo).bloquear(1L, FECHA);
        assertThat(eventos(1).get(0).motivo()).isEqualTo("REPARTIDOR_CAMBIADO");
    }

    @Test
    @DisplayName("cambiar repartidor: no disponible -> 422; inexistente o inactivo -> 404")
    void repartidorInvalido() {
        ruta(10L, centro, 4);
        Repartidor ocupado = Fabrica.repartidor(2L, "Luis");
        ocupado.setDisponible(false);
        Repartidor inactivo = Fabrica.repartidor(3L, "Andrea");
        inactivo.setActivo(false);
        when(repartidorRepository.findById(2L)).thenReturn(Optional.of(ocupado));
        when(repartidorRepository.findById(3L)).thenReturn(Optional.of(inactivo));
        when(repartidorRepository.findById(4L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.cambiarRepartidor(10L, 2L)).isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("no esta disponible");
        assertThatThrownBy(() -> servicio.cambiarRepartidor(10L, 3L)).isInstanceOf(RecursoNoEncontradoException.class);
        assertThatThrownBy(() -> servicio.cambiarRepartidor(10L, 4L)).isInstanceOf(RecursoNoEncontradoException.class);
        verify(publicador, never()).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("una ruta que no existe -> 404 sin tomar bloqueos")
    void rutaInexistente() {
        when(rutaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.reordenar(99L, List.of(1L))).isInstanceOf(RecursoNoEncontradoException.class);
        verifyNoInteractions(bloqueo);
    }

    // ---------------------------------------------------------------- mover / agregar pedido

    @Test
    @DisplayName("agregar un PENDIENTE: bloquea las zonas en orden ascendente, lo asigna y registra el historial")
    void agregaPendiente() {
        Ruta destino = ruta(10L, norte, 4, 1L);
        Pedido pedido = pedidoPendiente(5L, centro);

        servicio.agregarPedido(10L, 5L);

        InOrder orden = inOrder(bloqueo);
        orden.verify(bloqueo).bloquear(1L, FECHA); // zona del pedido (Centro) primero
        orden.verify(bloqueo).bloquear(2L, FECHA); // zona de la ruta (Norte) despues
        assertThat(destino.getPedidos()).contains(pedido);
        assertThat(pedido.getEstado()).isEqualTo(EstadoPedido.ASIGNADO);
        assertThat(pedido.getOrdenEnRuta()).isEqualTo(2);
        verify(seguimientoService).registrarCambio(5L, EstadoPedido.PENDIENTE, EstadoPedido.ASIGNADO, OrigenCambio.WEB);
        assertThat(eventos(1).get(0).motivo()).isEqualTo("PEDIDO_AGREGADO");
    }

    @Test
    @DisplayName("mover desde otra ruta: sale del origen, entra al destino, sigue ASIGNADO y se publican las dos rutas")
    void mueveEntreRutas() {
        Ruta origen = new Ruta(FECHA, centro, Fabrica.repartidor(2L, "Luis"), 4);
        ReflectionTestUtils.setField(origen, "id", 20L);
        Pedido pedido = pedidoPendiente(5L, centro);
        Pedido queda = Fabrica.pedido(6L, centro, FECHA);
        origen.agregarPedido(pedido);
        origen.agregarPedido(queda);
        Ruta destino = ruta(10L, centro, 4, 1L);

        servicio.agregarPedido(10L, 5L);

        assertThat(origen.getPedidos()).containsExactly(queda);
        assertThat(queda.getOrdenEnRuta()).isEqualTo(1);
        assertThat(destino.getPedidos()).extracting(Pedido::getId).containsExactly(1L, 5L);
        assertThat(pedido.getRuta()).isSameAs(destino);
        assertThat(pedido.getEstado()).isEqualTo(EstadoPedido.ASIGNADO);
        verify(bloqueo, times(1)).bloquear(1L, FECHA); // misma zona: un solo bloqueo
        verifyNoInteractions(seguimientoService);
        assertThat(eventos(2)).extracting(RutaActualizadaEvent::rutaId).containsExactly(20L, 10L);
    }

    @Test
    @DisplayName("ruta destino llena -> 409 RUTA_LLENA y el pedido no sale de su ruta (CP-09)")
    void rutaLlena() {
        Ruta origen = new Ruta(FECHA, centro, Fabrica.repartidor(2L, "Luis"), 4);
        ReflectionTestUtils.setField(origen, "id", 20L);
        Pedido pedido = pedidoPendiente(5L, centro);
        origen.agregarPedido(pedido);
        ruta(10L, centro, 2, 1L, 2L);

        assertThatThrownBy(() -> servicio.agregarPedido(10L, 5L)).isInstanceOf(ConflictoException.class)
                .hasMessageContaining("maximo de 2")
                .satisfies(e -> assertThat(((ApiException) e).getCodigo()).isEqualTo("RUTA_LLENA"));

        assertThat(origen.getPedidos()).containsExactly(pedido);
        verify(publicador, never()).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("pedido de otra fecha -> 422 FECHA_DISTINTA sin bloquear nada")
    void fechaDistinta() {
        ruta(10L, centro, 4);
        Pedido otroDia = Fabrica.pedido(5L, centro, FECHA.plusDays(1));
        when(pedidoRepository.findById(5L)).thenReturn(Optional.of(otroDia));

        assertThatThrownBy(() -> servicio.agregarPedido(10L, 5L)).isInstanceOf(ReglaNegocioException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCodigo()).isEqualTo("FECHA_DISTINTA"));
        verifyNoInteractions(bloqueo);
    }

    @Test
    @DisplayName("el pedido ya esta en esa ruta -> 409 PEDIDO_YA_EN_RUTA")
    void yaEstaEnLaRuta() {
        Ruta ruta = ruta(10L, centro, 4, 1L);
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(ruta.getPedidos().get(0)));

        assertThatThrownBy(() -> servicio.agregarPedido(10L, 1L)).isInstanceOf(ConflictoException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCodigo()).isEqualTo("PEDIDO_YA_EN_RUTA"));
    }

    @Test
    @DisplayName("un pedido sin ruta que ya no esta PENDIENTE no se mueve (409 PEDIDO_NO_MOVIBLE)")
    void pedidoNoMovible() {
        ruta(10L, centro, 4);
        Pedido raro = pedidoPendiente(5L, centro);
        raro.cambiarEstado(EstadoPedido.ASIGNADO);

        assertThatThrownBy(() -> servicio.agregarPedido(10L, 5L)).isInstanceOf(ConflictoException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCodigo()).isEqualTo("PEDIDO_NO_MOVIBLE"));
    }

    @Test
    @DisplayName("pedido inexistente -> 404")
    void pedidoInexistente() {
        ruta(10L, centro, 4);
        when(pedidoRepository.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.agregarPedido(10L, 5L)).isInstanceOf(RecursoNoEncontradoException.class);
        assertThatThrownBy(() -> servicio.quitarPedido(10L, 5L)).isInstanceOf(RecursoNoEncontradoException.class);
    }

    // ---------------------------------------------------------------- quitar y reordenar

    @Test
    @DisplayName("quitar: el pedido vuelve a PENDIENTE, se registra el historial y se publica PEDIDO_QUITADO")
    void quitaPedido() {
        Ruta ruta = ruta(10L, centro, 4, 1L, 2L);
        Pedido primero = ruta.getPedidos().get(0);
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(primero));

        RutaResponse respuesta = servicio.quitarPedido(10L, 1L);

        assertThat(respuesta.pedidos()).extracting(p -> p.id()).containsExactly(2L);
        assertThat(primero.getEstado()).isEqualTo(EstadoPedido.PENDIENTE);
        verify(seguimientoService).registrarCambio(1L, EstadoPedido.ASIGNADO, EstadoPedido.PENDIENTE, OrigenCambio.WEB);
        assertThat(eventos(1).get(0).motivo()).isEqualTo("PEDIDO_QUITADO");
    }

    @Test
    @DisplayName("reordenar: aplica el orden y publica ORDEN_CAMBIADO")
    void reordena() {
        ruta(10L, centro, 4, 1L, 2L, 3L);

        RutaResponse respuesta = servicio.reordenar(10L, List.of(3L, 1L, 2L));

        assertThat(respuesta.pedidos()).extracting(p -> p.id()).containsExactly(3L, 1L, 2L);
        assertThat(respuesta.pedidos()).extracting(p -> p.ordenEnRuta()).containsExactly(1, 2, 3);
        verify(bloqueo).bloquear(1L, FECHA);
        assertThat(eventos(1).get(0).motivo()).isEqualTo("ORDEN_CAMBIADO");
    }
}
