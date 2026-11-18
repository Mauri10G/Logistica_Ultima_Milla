package ec.edu.uta.logistica.rutas.service;

import ec.edu.uta.logistica.pedidos.evento.PedidoRegistradoEvent;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Pedido de ultimo momento automatico: al registrar un pedido para una fecha que ya tiene rutas armadas, se inserta
 * solo en una ruta ARMADA de su zona con espacio (la de parada mas cercana) o en una ruta nueva, con
 * {@link RutaService#insertarUltimoMomento}, que toma el mismo bloqueo por (zona, fecha) que el armado.
 *
 * <p>Corre en la misma transaccion del registro ({@code @EventListener} sincrono): la respuesta de
 * {@code POST /api/pedidos} ya trae el pedido ASIGNADO con su ruta, y si algo falla no queda un pedido a medias.
 * Si la fecha aun no tiene rutas, el pedido queda PENDIENTE y lo toma el armado. Si no hay repartidores disponibles
 * tambien queda PENDIENTE (se comprueba antes, para no abortar el registro).
 *
 * <p>Se apaga con {@code logistica.rutas.ultimo-momento-automatico=false}; el endpoint manual
 * {@code POST /api/rutas/ultimo-momento/{pedidoId}} sigue disponible.
 */
@Component
public class UltimoMomentoAutomatico {

    private static final Logger LOG = LoggerFactory.getLogger(UltimoMomentoAutomatico.class);

    private final RutaService rutaService;
    private final RutaRepository rutaRepository;
    private final RepartidorRepository repartidorRepository;
    private final boolean habilitado;

    public UltimoMomentoAutomatico(RutaService rutaService, RutaRepository rutaRepository,
                                   RepartidorRepository repartidorRepository,
                                   @Value("${logistica.rutas.ultimo-momento-automatico:true}") boolean habilitado) {
        this.rutaService = rutaService;
        this.rutaRepository = rutaRepository;
        this.repartidorRepository = repartidorRepository;
        this.habilitado = habilitado;
    }

    @EventListener
    public void alRegistrarPedido(PedidoRegistradoEvent evento) {
        if (!habilitado || rutaRepository.countByFecha(evento.fechaEntrega()) == 0) {
            return; // sin rutas armadas para esa fecha: lo tomara el armado
        }
        if (repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById().isEmpty()) {
            LOG.warn("Pedido {} queda PENDIENTE: no hay repartidores disponibles para insertarlo", evento.pedidoId());
            return;
        }
        rutaService.insertarUltimoMomento(evento.pedidoId());
        LOG.debug("Pedido {} insertado como ultimo momento ({})", evento.pedidoId(), evento.fechaEntrega());
    }
}
