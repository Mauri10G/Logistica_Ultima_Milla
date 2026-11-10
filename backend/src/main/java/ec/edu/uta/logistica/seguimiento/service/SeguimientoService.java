package ec.edu.uta.logistica.seguimiento.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.seguimiento.dto.HistorialResponse;
import ec.edu.uta.logistica.seguimiento.entity.HistorialEstadoPedido;
import ec.edu.uta.logistica.seguimiento.evento.PedidoEstadoCambiadoEvent;
import ec.edu.uta.logistica.seguimiento.repository.HistorialEstadoPedidoRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Punto unico para registrar cambios de estado: guarda el historial y publica el evento que
 * {@link ec.edu.uta.logistica.seguimiento.websocket.SeguimientoPublicador} envia por WebSocket
 * cuando la transaccion confirma.
 */
@Service
public class SeguimientoService {

    private final HistorialEstadoPedidoRepository historialRepository;
    private final ApplicationEventPublisher publicador;
    private final Clock reloj;

    public SeguimientoService(HistorialEstadoPedidoRepository historialRepository, ApplicationEventPublisher publicador,
                              Clock reloj) {
        this.historialRepository = historialRepository;
        this.publicador = publicador;
        this.reloj = reloj;
    }

    @Transactional
    public void registrarCambio(Long pedidoId, EstadoPedido anterior, EstadoPedido nuevo, OrigenCambio origen) {
        LocalDateTime ahora = LocalDateTime.now(reloj);
        historialRepository.save(new HistorialEstadoPedido(pedidoId, anterior, nuevo, ahora, origen));
        publicador.publishEvent(new PedidoEstadoCambiadoEvent(pedidoId, anterior, nuevo, origen, ahora));
    }

    @Transactional(readOnly = true)
    public List<HistorialResponse> historial(Long pedidoId) {
        return historialRepository.findByPedidoIdOrderByFechaCambioAscIdAsc(pedidoId).stream()
                .map(HistorialResponse::desde).toList();
    }
}
