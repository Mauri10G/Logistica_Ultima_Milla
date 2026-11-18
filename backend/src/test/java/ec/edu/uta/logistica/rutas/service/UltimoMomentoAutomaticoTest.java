package ec.edu.uta.logistica.rutas.service;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.pedidos.evento.PedidoRegistradoEvent;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import ec.edu.uta.logistica.testutil.Fabrica;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Decide cuando un pedido recien registrado se inserta solo como ultimo momento. */
@ExtendWith(MockitoExtension.class)
class UltimoMomentoAutomaticoTest {

    private static final LocalDate FECHA = LocalDate.of(2027, 2, 14);
    private static final PedidoRegistradoEvent EVENTO = new PedidoRegistradoEvent(7L, FECHA, 1L);

    @Mock
    private RutaService rutaService;
    @Mock
    private RutaRepository rutaRepository;
    @Mock
    private RepartidorRepository repartidorRepository;

    private UltimoMomentoAutomatico listener(boolean habilitado) {
        return new UltimoMomentoAutomatico(rutaService, rutaRepository, repartidorRepository, habilitado);
    }

    @Test
    @DisplayName("la fecha ya tiene rutas armadas: el pedido se inserta como ultimo momento")
    void insertaSiHayRutas() {
        when(rutaRepository.countByFecha(FECHA)).thenReturn(3L);
        when(repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById())
                .thenReturn(List.of(Fabrica.repartidor(1L, "Carlos")));

        listener(true).alRegistrarPedido(EVENTO);

        verify(rutaService).insertarUltimoMomento(7L);
    }

    @Test
    @DisplayName("la fecha aun no tiene rutas: el pedido queda PENDIENTE para el armado")
    void noInsertaSinRutas() {
        when(rutaRepository.countByFecha(FECHA)).thenReturn(0L);

        listener(true).alRegistrarPedido(EVENTO);

        verifyNoInteractions(rutaService, repartidorRepository);
    }

    @Test
    @DisplayName("sin repartidores disponibles no se intenta insertar (el registro no falla)")
    void noInsertaSinRepartidores() {
        when(rutaRepository.countByFecha(FECHA)).thenReturn(3L);
        when(repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById()).thenReturn(List.of());

        listener(true).alRegistrarPedido(EVENTO);

        verify(rutaService, never()).insertarUltimoMomento(7L);
    }

    @Test
    @DisplayName("con logistica.rutas.ultimo-momento-automatico=false no hace nada")
    void deshabilitado() {
        listener(false).alRegistrarPedido(EVENTO);

        verifyNoInteractions(rutaService, rutaRepository, repartidorRepository);
    }
}
