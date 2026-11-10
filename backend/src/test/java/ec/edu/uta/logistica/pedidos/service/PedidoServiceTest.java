package ec.edu.uta.logistica.pedidos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import ec.edu.uta.logistica.pedidos.dto.EstadoPedidoRequest;
import ec.edu.uta.logistica.pedidos.dto.PedidoRequest;
import ec.edu.uta.logistica.pedidos.dto.PedidoResponse;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.TransicionInvalidaException;
import ec.edu.uta.logistica.pedidos.repository.ClienteRepository;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.seguimiento.service.SeguimientoService;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Reglas CP-03 (zona), CP-04 (fecha), CP-05 (edicion) y transiciones de estado. */
@ExtendWith(MockitoExtension.class)
class PedidoServiceTest {

    // "hoy" fijo: 2027-02-10 en Guayaquil
    private static final Clock RELOJ = Clock.fixed(Instant.parse("2027-02-10T15:00:00Z"),
            ZoneId.of("America/Guayaquil"));
    private static final LocalDate HOY = LocalDate.of(2027, 2, 10);

    @Mock
    private PedidoRepository pedidoRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private ZonaRepository zonaRepository;
    @Mock
    private SeguimientoService seguimientoService;

    private PedidoService servicio;
    private final Zona centro = Fabrica.zona(1L, "Centro");

    @BeforeEach
    void preparar() {
        servicio = new PedidoService(pedidoRepository, clienteRepository, zonaRepository, seguimientoService, RELOJ);
    }

    private PedidoRequest solicitud(LocalDate fechaEntrega) {
        return new PedidoRequest(null, "Maria Torres", "0982000001", null, "Bolivar y Mera", -1.2412, -78.6197,
                fechaEntrega, LocalTime.of(10, 0), null, null);
    }

    @Test
    @DisplayName("CP-03: una direccion fuera de toda zona se rechaza con 422 y el mensaje del enunciado")
    void direccionFueraDeZona() {
        when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.registrar(solicitud(HOY)))
                .isInstanceOf(DireccionFueraDeZonaException.class)
                .hasMessage("La dirección no corresponde a ninguna zona configurada")
                .satisfies(e -> assertThat(((ReglaNegocioException) e).getStatus())
                        .isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));

        verify(pedidoRepository, never()).save(any());
        verifyNoInteractions(clienteRepository);
    }

    @Test
    @DisplayName("CP-04: no se permite una fecha de entrega anterior a hoy")
    void fechaPasada() {
        assertThatThrownBy(() -> servicio.registrar(solicitud(HOY.minusDays(1))))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("anterior a hoy");

        verifyNoInteractions(zonaRepository, pedidoRepository);
    }

    @Test
    @DisplayName("se acepta la entrega el mismo dia y se asigna la zona calculada")
    void registraElMismoDia() {
        when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(centro));
        when(clienteRepository.save(any(Cliente.class))).thenAnswer(i -> i.getArgument(0));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        PedidoResponse respuesta = servicio.registrar(solicitud(HOY));

        assertThat(respuesta.zonaNombre()).isEqualTo("Centro");
        assertThat(respuesta.estado()).isEqualTo(EstadoPedido.PENDIENTE);
        assertThat(respuesta.fechaEntrega()).isEqualTo(HOY);
        // la fecha de registro viene del reloj y es distinta de la de entrega
        assertThat(respuesta.fechaRegistro().toLocalDate()).isEqualTo(HOY);
        assertThat(respuesta.registradoPorPersonal()).isTrue();
    }

    @Test
    @DisplayName("sin clienteId hacen falta nombres y telefono del cliente")
    void exigeDatosDelCliente() {
        when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(centro));
        PedidoRequest sinCliente = new PedidoRequest(null, null, null, null, "Bolivar y Mera", -1.2412, -78.6197,
                HOY, LocalTime.of(10, 0), null, null);

        assertThatThrownBy(() -> servicio.registrar(sinCliente)).isInstanceOf(SolicitudInvalidaException.class);
    }

    @Test
    @DisplayName("CP-05: solo se puede editar un pedido en estado PENDIENTE")
    void soloEditaPendientes() {
        Pedido asignado = Fabrica.pedido(7L, centro, HOY.plusDays(1));
        asignado.cambiarEstado(EstadoPedido.ASIGNADO);
        when(pedidoRepository.findById(7L)).thenReturn(Optional.of(asignado));

        assertThatThrownBy(() -> servicio.editar(7L, solicitud(HOY.plusDays(1))))
                .isInstanceOf(ConflictoException.class)
                .hasMessageContaining("PENDIENTE");

        verify(pedidoRepository, never()).save(any());
    }

    @Test
    @DisplayName("un pedido PENDIENTE se edita y recalcula su zona")
    void editaPendiente() {
        Pedido pendiente = Fabrica.pedido(7L, centro, HOY.plusDays(1));
        Zona otraZona = Fabrica.zona(2L, "Norte");
        when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pendiente));
        when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(otraZona));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        PedidoResponse respuesta = servicio.editar(7L, solicitud(HOY.plusDays(3)));

        assertThat(respuesta.zonaNombre()).isEqualTo("Norte");
        assertThat(respuesta.fechaEntrega()).isEqualTo(HOY.plusDays(3));
    }

    @Test
    @DisplayName("no se puede eliminar un pedido que ya no esta PENDIENTE")
    void noEliminaAsignados() {
        Pedido asignado = Fabrica.pedido(7L, centro, HOY.plusDays(1));
        asignado.cambiarEstado(EstadoPedido.ASIGNADO);
        when(pedidoRepository.findById(7L)).thenReturn(Optional.of(asignado));

        assertThatThrownBy(() -> servicio.eliminar(7L)).isInstanceOf(ConflictoException.class);

        verify(pedidoRepository, never()).delete(any(Pedido.class));
    }

    @Test
    @DisplayName("PATCH estado: avanza un paso, guarda el historial con su origen y notifica")
    void cambiaEstado() {
        Pedido pedido = Fabrica.pedido(7L, centro, HOY.plusDays(1));
        pedido.cambiarEstado(EstadoPedido.ASIGNADO);
        when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pedido));

        PedidoResponse respuesta = servicio.cambiarEstado(7L,
                new EstadoPedidoRequest(EstadoPedido.RECOGIDO, OrigenCambio.MOVIL));

        assertThat(respuesta.estado()).isEqualTo(EstadoPedido.RECOGIDO);
        verify(seguimientoService).registrarCambio(7L, EstadoPedido.ASIGNADO, EstadoPedido.RECOGIDO,
                OrigenCambio.MOVIL);
    }

    @Test
    @DisplayName("PATCH estado: una transicion invalida lanza excepcion y no deja historial")
    void transicionInvalida() {
        Pedido pedido = Fabrica.pedido(7L, centro, HOY.plusDays(1));
        pedido.cambiarEstado(EstadoPedido.ASIGNADO);
        when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pedido));

        assertThatThrownBy(() -> servicio.cambiarEstado(7L, new EstadoPedidoRequest(EstadoPedido.ENTREGADO, null)))
                .isInstanceOf(TransicionInvalidaException.class);

        assertThat(pedido.getEstado()).isEqualTo(EstadoPedido.ASIGNADO);
        verifyNoInteractions(seguimientoService);
    }

    @Test
    @DisplayName("PATCH estado: ASIGNADO solo se establece al asignar a una ruta")
    void noPermiteAsignarPorPatch() {
        Pedido pedido = Fabrica.pedido(7L, centro, HOY.plusDays(1));
        when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pedido));

        assertThatThrownBy(() -> servicio.cambiarEstado(7L, new EstadoPedidoRequest(EstadoPedido.ASIGNADO, null)))
                .isInstanceOf(ReglaNegocioException.class);

        verifyNoInteractions(seguimientoService);
    }
}
