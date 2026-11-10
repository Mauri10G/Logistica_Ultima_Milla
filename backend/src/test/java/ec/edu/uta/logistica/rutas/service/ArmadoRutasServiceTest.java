package ec.edu.uta.logistica.rutas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import ec.edu.uta.logistica.common.config.LogisticaProperties;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.rutas.algoritmo.EstrategiaArmadoRutas;
import ec.edu.uta.logistica.rutas.algoritmo.RutaPlanificada;
import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.entity.Ruta;
import ec.edu.uta.logistica.rutas.repository.CargaRepartidor;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import ec.edu.uta.logistica.seguimiento.evento.RutasArmadasEvent;
import ec.edu.uta.logistica.seguimiento.service.SeguimientoService;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class ArmadoRutasServiceTest {

    private static final LocalDate FECHA = LocalDate.of(2027, 2, 14);

    @Mock
    private PedidoRepository pedidoRepository;
    @Mock
    private RepartidorRepository repartidorRepository;
    @Mock
    private RutaRepository rutaRepository;
    @Mock
    private BloqueoZonaFecha bloqueo;
    @Mock
    private EstrategiaArmadoRutas estrategia;
    @Mock
    private SeguimientoService seguimientoService;
    @Mock
    private ApplicationEventPublisher publicador;

    private ArmadoRutasService servicio;
    private final Zona centro = Fabrica.zona(1L, "Centro");
    private final Zona norte = Fabrica.zona(2L, "Norte");
    private final Repartidor carlos = Fabrica.repartidor(1L, "Carlos");

    @BeforeEach
    void preparar() {
        LogisticaProperties propiedades = new LogisticaProperties("America/Guayaquil",
                new LogisticaProperties.Rutas(6, new LogisticaProperties.Armado(true, "0 0 18 * * *", 1)),
                new LogisticaProperties.Cors(List.of()));
        servicio = new ArmadoRutasService(pedidoRepository, repartidorRepository, rutaRepository, bloqueo, estrategia,
                seguimientoService, publicador, propiedades);
    }

    @Test
    @DisplayName("sin pedidos pendientes no bloquea, no planifica y devuelve vacio")
    void sinPendientes() {
        when(pedidoRepository.zonaIdsConPendientes(FECHA, EstadoPedido.PENDIENTE)).thenReturn(List.of());

        assertThat(servicio.armar(FECHA)).isEmpty();

        verifyNoInteractions(bloqueo, estrategia, rutaRepository, publicador);
    }

    @Test
    @DisplayName("bloquea las zonas en orden ascendente ANTES de leer los pendientes y asigna los pedidos")
    void bloqueaLuegoLeeYAsigna() {
        Pedido p1 = Fabrica.pedido(1L, centro, FECHA);
        Pedido p2 = Fabrica.pedido(2L, centro, FECHA);
        Pedido p3 = Fabrica.pedido(3L, norte, FECHA);
        when(pedidoRepository.zonaIdsConPendientes(FECHA, EstadoPedido.PENDIENTE)).thenReturn(List.of(1L, 2L));
        when(pedidoRepository.buscarSinRuta(FECHA, EstadoPedido.PENDIENTE)).thenReturn(List.of(p1, p2, p3));
        when(repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById()).thenReturn(List.of(carlos));
        when(rutaRepository.cargaPorRepartidor(FECHA)).thenReturn(List.of(new CargaRepartidor(1L, 3)));
        when(estrategia.planificar(any(), any(), any(), anyInt())).thenReturn(List.of(
                new RutaPlanificada(centro, carlos, List.of(p1, p2)),
                new RutaPlanificada(norte, carlos, List.of(p3))));
        when(rutaRepository.save(any(Ruta.class))).thenAnswer(i -> i.getArgument(0));

        List<RutaResponse> resultado = servicio.armar(FECHA);

        // orden: bloqueos ascendentes y recien despues la lectura de pendientes
        InOrder orden = inOrder(bloqueo, pedidoRepository);
        orden.verify(bloqueo).bloquear(1L, FECHA);
        orden.verify(bloqueo).bloquear(2L, FECHA);
        orden.verify(pedidoRepository).buscarSinRuta(FECHA, EstadoPedido.PENDIENTE);

        assertThat(resultado).hasSize(2);
        assertThat(resultado.get(0).pedidos()).hasSize(2);
        assertThat(resultado.get(0).maxPedidos()).isEqualTo(6);
        assertThat(List.of(p1, p2, p3)).allMatch(p -> p.getEstado() == EstadoPedido.ASIGNADO);
        assertThat(p1.getOrdenEnRuta()).isEqualTo(1);
        assertThat(p2.getOrdenEnRuta()).isEqualTo(2);
        verify(seguimientoService, org.mockito.Mockito.times(3)).registrarCambio(anyLong(),
                eq(EstadoPedido.PENDIENTE), eq(EstadoPedido.ASIGNADO), eq(OrigenCambio.WEB));

        ArgumentCaptor<RutasArmadasEvent> evento = ArgumentCaptor.forClass(RutasArmadasEvent.class);
        verify(publicador).publishEvent(evento.capture());
        assertThat(evento.getValue().fecha()).isEqualTo(FECHA);
    }

    @Test
    @DisplayName("pasa a la estrategia el maximo configurado y la carga actual de los repartidores")
    void usaLaConfiguracionYLaCarga() {
        Pedido p1 = Fabrica.pedido(1L, centro, FECHA);
        when(pedidoRepository.zonaIdsConPendientes(FECHA, EstadoPedido.PENDIENTE)).thenReturn(List.of(1L));
        when(pedidoRepository.buscarSinRuta(FECHA, EstadoPedido.PENDIENTE)).thenReturn(List.of(p1));
        when(repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById()).thenReturn(List.of(carlos));
        when(rutaRepository.cargaPorRepartidor(FECHA)).thenReturn(List.of(new CargaRepartidor(1L, 3)));
        when(estrategia.planificar(any(), any(), any(), anyInt())).thenReturn(List.of());

        servicio.armar(FECHA);

        verify(estrategia).planificar(List.of(p1), List.of(carlos), Map.of(1L, 3), 6);
    }

    @Test
    @DisplayName("sin repartidores disponibles lanza ReglaNegocioException y no asigna nada")
    void sinRepartidores() {
        when(pedidoRepository.zonaIdsConPendientes(FECHA, EstadoPedido.PENDIENTE)).thenReturn(List.of(1L));
        when(pedidoRepository.buscarSinRuta(FECHA, EstadoPedido.PENDIENTE))
                .thenReturn(List.of(Fabrica.pedido(1L, centro, FECHA)));
        when(repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById()).thenReturn(List.of());

        assertThatThrownBy(() -> servicio.armar(FECHA)).isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("repartidores");

        verify(estrategia, never()).planificar(any(), any(), any(), anyInt());
        verify(rutaRepository, never()).save(any());
        verify(publicador, never()).publishEvent(any(Object.class));
    }
}
