package ec.edu.uta.logistica.rutas.service;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.rutas.entity.EstadoRuta;
import ec.edu.uta.logistica.rutas.entity.Ruta;
import ec.edu.uta.logistica.seguimiento.evento.PedidoEstadoCambiadoEvent;
import ec.edu.uta.logistica.seguimiento.evento.RutaActualizadaEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Mantiene el estado de la ruta a partir de los pedidos: ARMADA -> EN_CURSO cuando se recoge el primero,
 * y EN_CURSO -> FINALIZADA cuando todos estan ENTREGADO. Corre en la misma transaccion que el cambio del pedido.
 */
@Component
public class RutaProgresoListener {

    private final PedidoRepository pedidoRepository;
    private final ApplicationEventPublisher publicador;

    public RutaProgresoListener(PedidoRepository pedidoRepository, ApplicationEventPublisher publicador) {
        this.pedidoRepository = pedidoRepository;
        this.publicador = publicador;
    }

    @EventListener
    public void alCambiarEstadoPedido(PedidoEstadoCambiadoEvent evento) {
        EstadoPedido nuevo = evento.estadoNuevo();
        if (nuevo != EstadoPedido.RECOGIDO && nuevo != EstadoPedido.ENTREGADO) {
            return;
        }
        Pedido pedido = pedidoRepository.findById(evento.pedidoId()).orElse(null);
        if (pedido == null || pedido.getRuta() == null) {
            return;
        }
        Ruta ruta = pedido.getRuta();
        EstadoRuta antes = ruta.getEstado();
        if (nuevo == EstadoPedido.RECOGIDO) {
            ruta.iniciar();
        } else if (ruta.todosEntregados()) {
            ruta.finalizar();
        }
        if (ruta.getEstado() != antes) {
            publicador.publishEvent(new RutaActualizadaEvent(ruta.getId(), ruta.getFecha(), ruta.getEstado().name(),
                    "PROGRESO_PEDIDOS"));
        }
    }
}
