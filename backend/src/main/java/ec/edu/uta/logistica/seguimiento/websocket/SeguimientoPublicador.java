package ec.edu.uta.logistica.seguimiento.websocket;

import java.util.List;

import ec.edu.uta.logistica.seguimiento.evento.PedidoEstadoCambiadoEvent;
import ec.edu.uta.logistica.seguimiento.evento.RutaActualizadaEvent;
import ec.edu.uta.logistica.seguimiento.evento.RutasArmadasEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Publica por STOMP lo que paso en el backend. Se envia DESPUES del commit para que la web nunca reciba
 * un cambio que luego se revierta (y para que al recargar ya vea el dato).
 */
@Component
public class SeguimientoPublicador {

    public static final String TOPIC_PEDIDOS = "/topic/pedidos";
    public static final String TOPIC_RUTAS = "/topic/rutas";

    private final SimpMessagingTemplate mensajeria;

    public SeguimientoPublicador(SimpMessagingTemplate mensajeria) {
        this.mensajeria = mensajeria;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alCambiarEstadoPedido(PedidoEstadoCambiadoEvent evento) {
        mensajeria.convertAndSend(TOPIC_PEDIDOS, evento);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alArmarRutas(RutasArmadasEvent evento) {
        mensajeria.convertAndSend(TOPIC_RUTAS,
                new MensajeRutas("RUTAS_ARMADAS", evento.fecha(), evento.rutaIds(), null, null));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alActualizarRuta(RutaActualizadaEvent evento) {
        mensajeria.convertAndSend(TOPIC_RUTAS, new MensajeRutas("RUTA_ACTUALIZADA", evento.fecha(),
                List.of(evento.rutaId()), evento.estado(), evento.motivo()));
    }
}
