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
import ec.edu.uta.logistica.pedidos.dto.HoraServidorResponse;
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
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Reglas CP-03 (zona), CP-04 (fecha y hora de entrega), CP-05 (edicion) y transiciones de estado. */
@ExtendWith(MockitoExtension.class)
class PedidoServiceTest {

    private static final ZoneId GUAYAQUIL = ZoneId.of("America/Guayaquil");
    // "ahora" fijo: 2027-02-10 10:00 en Guayaquil (15:00 UTC)
    private static final Clock RELOJ = Clock.fixed(Instant.parse("2027-02-10T15:00:00Z"), GUAYAQUIL);
    private static final LocalDate HOY = LocalDate.of(2027, 2, 10);
    private static final int ANTICIPACION_MINUTOS = 30;

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
        servicio = servicioCon(RELOJ, ANTICIPACION_MINUTOS);
    }

    private PedidoService servicioCon(Clock reloj, int anticipacionMinutos) {
        return new PedidoService(pedidoRepository, clienteRepository, zonaRepository, seguimientoService, reloj,
                anticipacionMinutos);
    }

    private static Clock relojA(String instanteUtc) {
        return Clock.fixed(Instant.parse(instanteUtc), GUAYAQUIL);
    }

    /** Entrega a las 12:00: es valida hoy (ahora son las 10:00). */
    private PedidoRequest solicitud(LocalDate fechaEntrega) {
        return solicitud(fechaEntrega, LocalTime.of(12, 0));
    }

    private PedidoRequest solicitud(LocalDate fechaEntrega, LocalTime horaEntrega) {
        return new PedidoRequest(null, "Maria Torres", "0982000001", null, "Bolivar y Mera", -1.2412, -78.6197,
                fechaEntrega, horaEntrega, null, null);
    }

    private void preparaGuardadoValido() {
        when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(centro));
        when(clienteRepository.save(any(Cliente.class))).thenAnswer(i -> i.getArgument(0));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));
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

    @Nested
    @DisplayName("Hora de entrega: se valida contra la hora del servidor mas la anticipacion minima (30 min)")
    class HoraDeEntrega {

        @Test
        @DisplayName("registrar: hoy con una hora ya pasada se rechaza con 422 y el mensaje con la hora del servidor")
        void registrarHoyConHoraPasada() {
            assertThatThrownBy(() -> servicio.registrar(solicitud(HOY, LocalTime.of(7, 0))))
                    .isInstanceOf(ReglaNegocioException.class)
                    .hasMessage("La hora de entrega debe ser al menos 30 minutos después de la hora actual del "
                            + "servidor, 10:00")
                    .satisfies(e -> {
                        ReglaNegocioException regla = (ReglaNegocioException) e;
                        assertThat(regla.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                        assertThat(regla.getCodigo()).isEqualTo("HORA_ENTREGA_INVALIDA");
                    });

            verifyNoInteractions(zonaRepository, clienteRepository, pedidoRepository);
        }

        @Test
        @DisplayName("registrar: hoy con una hora dentro de la anticipacion (10:29 con ahora 10:00) se rechaza")
        void registrarHoyDentroDeLaAnticipacion() {
            assertThatThrownBy(() -> servicio.registrar(solicitud(HOY, LocalTime.of(10, 29))))
                    .isInstanceOf(ReglaNegocioException.class)
                    .hasMessageContaining("al menos 30 minutos");
            assertThatThrownBy(() -> servicio.registrar(solicitud(HOY, LocalTime.of(10, 0))))
                    .isInstanceOf(ReglaNegocioException.class);

            verifyNoInteractions(zonaRepository, clienteRepository, pedidoRepository);
        }

        @Test
        @DisplayName("registrar: hoy con una hora valida se acepta, tambien justo en el limite (10:30)")
        void registrarHoyConHoraValida() {
            preparaGuardadoValido();

            assertThat(servicio.registrar(solicitud(HOY, LocalTime.of(10, 30))).horaEntrega())
                    .isEqualTo(LocalTime.of(10, 30));
            assertThat(servicio.registrar(solicitud(HOY, LocalTime.of(19, 45))).horaEntrega())
                    .isEqualTo(LocalTime.of(19, 45));
        }

        @Test
        @DisplayName("registrar: manana se acepta a cualquier hora, incluso 00:00 y una hora menor que la actual")
        void registrarMananaACualquierHora() {
            preparaGuardadoValido();

            for (LocalTime hora : new LocalTime[] {LocalTime.MIDNIGHT, LocalTime.of(7, 0), LocalTime.of(23, 59)}) {
                assertThat(servicio.registrar(solicitud(HOY.plusDays(1), hora)).horaEntrega()).isEqualTo(hora);
            }
        }

        @Test
        @DisplayName("editar: hoy con una hora pasada o dentro de la anticipacion se rechaza y el pedido no cambia")
        void editarHoyConHoraInvalida() {
            Pedido pendiente = Fabrica.pedido(7L, centro, HOY.plusDays(1));
            when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pendiente));

            assertThatThrownBy(() -> servicio.editar(7L, solicitud(HOY, LocalTime.of(7, 0))))
                    .isInstanceOf(ReglaNegocioException.class)
                    .hasMessageContaining("hora actual del servidor, 10:00");
            assertThatThrownBy(() -> servicio.editar(7L, solicitud(HOY, LocalTime.of(10, 15))))
                    .isInstanceOf(ReglaNegocioException.class)
                    .hasMessageContaining("al menos 30 minutos");

            verify(pedidoRepository, never()).save(any());
            verifyNoInteractions(zonaRepository);
        }

        @Test
        @DisplayName("editar: hoy con una hora valida se acepta")
        void editarHoyConHoraValida() {
            Pedido pendiente = Fabrica.pedido(7L, centro, HOY.plusDays(1));
            when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pendiente));
            when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(centro));
            when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

            PedidoResponse respuesta = servicio.editar(7L, solicitud(HOY, LocalTime.of(10, 30)));

            assertThat(respuesta.fechaEntrega()).isEqualTo(HOY);
            assertThat(respuesta.horaEntrega()).isEqualTo(LocalTime.of(10, 30));
        }

        @Test
        @DisplayName("editar: manana a cualquier hora se acepta")
        void editarMananaACualquierHora() {
            Pedido pendiente = Fabrica.pedido(7L, centro, HOY.plusDays(3));
            when(pedidoRepository.findById(7L)).thenReturn(Optional.of(pendiente));
            when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(centro));
            when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

            PedidoResponse respuesta = servicio.editar(7L, solicitud(HOY.plusDays(1), LocalTime.of(6, 0)));

            assertThat(respuesta.fechaEntrega()).isEqualTo(HOY.plusDays(1));
            assertThat(respuesta.horaEntrega()).isEqualTo(LocalTime.of(6, 0));
        }

        @Test
        @DisplayName("la hora actual se toma en minutos: con ahora 10:00:40 la entrega de las 10:30 es valida")
        void ignoraLosSegundosDeAhora() {
            preparaGuardadoValido();
            PedidoService conSegundos = servicioCon(relojA("2027-02-10T15:00:40Z"), ANTICIPACION_MINUTOS);

            assertThat(conSegundos.registrar(solicitud(HOY, LocalTime.of(10, 30))).horaEntrega())
                    .isEqualTo(LocalTime.of(10, 30));
            assertThatThrownBy(() -> conSegundos.registrar(solicitud(HOY, LocalTime.of(10, 29))))
                    .isInstanceOf(ReglaNegocioException.class);
        }

        @Test
        @DisplayName("la anticipacion es configurable: con 90 minutos el mensaje y el limite cambian")
        void anticipacionConfigurable() {
            PedidoService conNoventa = servicioCon(RELOJ, 90);

            assertThatThrownBy(() -> conNoventa.registrar(solicitud(HOY, LocalTime.of(11, 0))))
                    .isInstanceOf(ReglaNegocioException.class)
                    .hasMessage("La hora de entrega debe ser al menos 90 minutos después de la hora actual del "
                            + "servidor, 10:00");

            preparaGuardadoValido();
            assertThat(conNoventa.registrar(solicitud(HOY, LocalTime.of(11, 30))).horaEntrega())
                    .isEqualTo(LocalTime.of(11, 30));
        }

        @Test
        @DisplayName("solo cuenta el Clock del backend en Guayaquil: 03:00 UTC son las 22:00 del dia anterior")
        void usaLaZonaDelBackend() {
            preparaGuardadoValido();
            PedidoService noche = servicioCon(relojA("2027-02-11T03:00:00Z"), ANTICIPACION_MINUTOS);

            assertThatThrownBy(() -> noche.registrar(solicitud(HOY, LocalTime.of(22, 15))))
                    .isInstanceOf(ReglaNegocioException.class)
                    .hasMessageContaining("hora actual del servidor, 22:00");
            assertThat(noche.registrar(solicitud(HOY, LocalTime.of(22, 30))).fechaEntrega()).isEqualTo(HOY);
        }
    }

    @Nested
    @DisplayName("GET /api/servidor/hora")
    class HoraDelServidor {

        @Test
        @DisplayName("devuelve fecha, hora, zona horaria, anticipacion y la primera entrega aceptada")
        void devuelveLaHoraDelServidor() {
            HoraServidorResponse respuesta = servicio.horaServidor();

            assertThat(respuesta.fecha()).isEqualTo(HOY);
            assertThat(respuesta.hora()).isEqualTo(LocalTime.of(10, 0));
            assertThat(respuesta.zonaHoraria()).isEqualTo("America/Guayaquil");
            assertThat(respuesta.anticipacionMinimaMinutos()).isEqualTo(30);
            assertThat(respuesta.entregaMinimaFecha()).isEqualTo(HOY);
            assertThat(respuesta.entregaMinimaHora()).isEqualTo(LocalTime.of(10, 30));
        }

        @Test
        @DisplayName("cerca de la medianoche la primera entrega aceptada pasa a manana")
        void cercaDeLaMedianoche() {
            // 04:50 UTC del 11 es 23:50 del 10 de febrero en Guayaquil
            HoraServidorResponse respuesta = servicioCon(relojA("2027-02-11T04:50:30Z"), 30).horaServidor();

            assertThat(respuesta.fecha()).isEqualTo(HOY);
            assertThat(respuesta.hora()).isEqualTo(LocalTime.of(23, 50));
            assertThat(respuesta.entregaMinimaFecha()).isEqualTo(HOY.plusDays(1));
            assertThat(respuesta.entregaMinimaHora()).isEqualTo(LocalTime.of(0, 20));
        }
    }

    @Test
    @DisplayName("sin clienteId hacen falta nombres y telefono del cliente")
    void exigeDatosDelCliente() {
        when(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).thenReturn(Optional.of(centro));
        PedidoRequest sinCliente = new PedidoRequest(null, null, null, null, "Bolivar y Mera", -1.2412, -78.6197,
                HOY, LocalTime.of(12, 0), null, null);

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
