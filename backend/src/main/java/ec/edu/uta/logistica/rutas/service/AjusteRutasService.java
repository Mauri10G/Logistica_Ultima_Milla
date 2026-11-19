package ec.edu.uta.logistica.rutas.service;

import java.time.LocalDate;
import java.util.List;
import java.util.TreeSet;

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
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ajustes manuales de rutas desde la web (solo STAFF), para corregir lo que el armado no asigno bien:
 * cambiar el repartidor, mover un pedido a otra ruta, sacarlo (vuelve a PENDIENTE) y reordenar las paradas.
 *
 * <p>Concurrencia: igual que el armado y el ultimo momento, cada ajuste toma {@link BloqueoZonaFecha} por cada
 * (zona, fecha) que toca, en orden ascendente de zona, y relee la ruta y el pedido con bloqueo antes de decidir. Asi un
 * ajuste nunca deja una ruta por encima del maximo ni un pedido en dos rutas aunque coincida con un armado.
 * Solo se ajustan rutas ARMADA. Cada cambio se publica en {@code /topic/rutas} despues del commit.
 */
@Service
public class AjusteRutasService {

    public static final String MOTIVO_REPARTIDOR = "REPARTIDOR_CAMBIADO";
    public static final String MOTIVO_PEDIDO_AGREGADO = "PEDIDO_AGREGADO";
    public static final String MOTIVO_PEDIDO_MOVIDO = "PEDIDO_MOVIDO";
    public static final String MOTIVO_PEDIDO_QUITADO = "PEDIDO_QUITADO";
    public static final String MOTIVO_ORDEN = "ORDEN_CAMBIADO";

    private final RutaRepository rutaRepository;
    private final PedidoRepository pedidoRepository;
    private final RepartidorRepository repartidorRepository;
    private final BloqueoZonaFecha bloqueo;
    private final SeguimientoService seguimientoService;
    private final ApplicationEventPublisher publicador;
    private final EntityManager entityManager;

    public AjusteRutasService(RutaRepository rutaRepository, PedidoRepository pedidoRepository,
                              RepartidorRepository repartidorRepository, BloqueoZonaFecha bloqueo,
                              SeguimientoService seguimientoService, ApplicationEventPublisher publicador,
                              EntityManager entityManager) {
        this.rutaRepository = rutaRepository;
        this.pedidoRepository = pedidoRepository;
        this.repartidorRepository = repartidorRepository;
        this.bloqueo = bloqueo;
        this.seguimientoService = seguimientoService;
        this.publicador = publicador;
        this.entityManager = entityManager;
    }

    /** PATCH /api/rutas/{id}/repartidor: el nuevo repartidor debe estar activo y disponible. */
    @Transactional
    public RutaResponse cambiarRepartidor(Long rutaId, Long repartidorId) {
        Ruta ruta = buscarRuta(rutaId);
        bloquear(ruta.getFecha(), ruta.getZona().getId());
        entityManager.refresh(ruta, LockModeType.PESSIMISTIC_WRITE);

        Repartidor repartidor = repartidorRepository.findById(repartidorId).filter(Repartidor::isActivo)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el repartidor con id " + repartidorId));
        if (!repartidor.isDisponible()) {
            throw new ReglaNegocioException("REPARTIDOR_NO_DISPONIBLE",
                    "El repartidor " + repartidor.getNombres() + " no esta disponible");
        }
        ruta.asignarRepartidor(repartidor);
        notificar(ruta, MOTIVO_REPARTIDOR);
        return RutaResponse.desde(ruta);
    }

    /**
     * POST /api/rutas/{id}/pedidos/{pedidoId}: mueve el pedido a esta ruta (al final). Puede venir de otra ruta ARMADA
     * de la misma fecha, aunque sea de otra zona, o estar PENDIENTE sin ruta. Respeta el maximo de la ruta destino.
     */
    @Transactional
    public RutaResponse agregarPedido(Long rutaId, Long pedidoId) {
        Ruta destino = buscarRuta(rutaId);
        Pedido pedido = buscarPedido(pedidoId);
        if (!pedido.getFechaEntrega().equals(destino.getFecha())) {
            throw new ReglaNegocioException("FECHA_DISTINTA", "El pedido " + pedidoId + " se entrega el "
                    + pedido.getFechaEntrega() + " y la ruta es del " + destino.getFecha());
        }
        Long zonaOrigen = pedido.getRuta() != null ? pedido.getRuta().getZona().getId() : null;
        bloquear(destino.getFecha(), destino.getZona().getId(), pedido.getZona().getId(), zonaOrigen);

        // Datos frescos con los bloqueos tomados: otra transaccion pudo cambiar la ruta o el pedido mientras se esperaba
        entityManager.refresh(destino, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(pedido, LockModeType.PESSIMISTIC_WRITE);
        Ruta origen = pedido.getRuta();
        if (origen != null) {
            entityManager.refresh(origen, LockModeType.PESSIMISTIC_WRITE);
        }

        destino.exigirModificable();
        if (destino.contiene(pedido)) {
            throw new ConflictoException("PEDIDO_YA_EN_RUTA",
                    "El pedido " + pedidoId + " ya esta en la ruta " + rutaId);
        }
        if (!destino.tieneEspacio()) {
            throw new ConflictoException("RUTA_LLENA",
                    "La ruta " + rutaId + " ya tiene el maximo de " + destino.getMaxPedidos() + " pedidos");
        }

        EstadoPedido anterior = pedido.getEstado();
        if (origen != null) {
            origen.quitarPedido(pedido); // valida que el origen este ARMADA y el pedido ASIGNADO
        } else if (anterior != EstadoPedido.PENDIENTE) {
            throw new ConflictoException("PEDIDO_NO_MOVIBLE",
                    "Solo se puede mover un pedido PENDIENTE o ASIGNADO (estado actual: " + anterior + ")");
        }
        destino.agregarPedido(pedido);
        entityManager.flush();

        if (origen == null) {
            // PENDIENTE -> ASIGNADO; si venia de otra ruta sigue ASIGNADO y no hay cambio de estado que registrar
            seguimientoService.registrarCambio(pedido.getId(), anterior, pedido.getEstado(), OrigenCambio.WEB);
            notificar(destino, MOTIVO_PEDIDO_AGREGADO);
        } else {
            notificar(origen, MOTIVO_PEDIDO_MOVIDO);
            notificar(destino, MOTIVO_PEDIDO_MOVIDO);
        }
        return RutaResponse.desde(destino);
    }

    /** DELETE /api/rutas/{id}/pedidos/{pedidoId}: saca el pedido, que vuelve a PENDIENTE sin ruta. */
    @Transactional
    public RutaResponse quitarPedido(Long rutaId, Long pedidoId) {
        Ruta ruta = buscarRuta(rutaId);
        Pedido pedido = buscarPedido(pedidoId);
        bloquear(ruta.getFecha(), ruta.getZona().getId());
        entityManager.refresh(ruta, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(pedido, LockModeType.PESSIMISTIC_WRITE);

        ruta.quitarPedido(pedido);
        entityManager.flush();
        seguimientoService.registrarCambio(pedido.getId(), EstadoPedido.ASIGNADO, EstadoPedido.PENDIENTE,
                OrigenCambio.WEB);
        notificar(ruta, MOTIVO_PEDIDO_QUITADO);
        return RutaResponse.desde(ruta);
    }

    /** PUT /api/rutas/{id}/orden: {@code idsEnOrden} es el nuevo orden de visita, con todos los pedidos de la ruta. */
    @Transactional
    public RutaResponse reordenar(Long rutaId, List<Long> idsEnOrden) {
        Ruta ruta = buscarRuta(rutaId);
        bloquear(ruta.getFecha(), ruta.getZona().getId());
        entityManager.refresh(ruta, LockModeType.PESSIMISTIC_WRITE);

        ruta.reordenar(idsEnOrden);
        entityManager.flush();
        notificar(ruta, MOTIVO_ORDEN);
        return RutaResponse.desde(ruta);
    }

    /** Bloquea cada (zona, fecha) una sola vez y en orden ascendente de zona (evita interbloqueos). */
    private void bloquear(LocalDate fecha, Long... zonaIds) {
        TreeSet<Long> ordenadas = new TreeSet<>();
        for (Long zonaId : zonaIds) {
            if (zonaId != null) {
                ordenadas.add(zonaId);
            }
        }
        ordenadas.forEach(zonaId -> bloqueo.bloquear(zonaId, fecha));
    }

    private void notificar(Ruta ruta, String motivo) {
        publicador.publishEvent(new RutaActualizadaEvent(ruta.getId(), ruta.getFecha(), ruta.getEstado().name(),
                motivo));
    }

    private Ruta buscarRuta(Long rutaId) {
        return rutaRepository.findById(rutaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe la ruta con id " + rutaId));
    }

    private Pedido buscarPedido(Long pedidoId) {
        return pedidoRepository.findById(pedidoId)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el pedido con id " + pedidoId));
    }
}
