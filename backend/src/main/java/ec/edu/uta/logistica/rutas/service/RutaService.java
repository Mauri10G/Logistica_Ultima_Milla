package ec.edu.uta.logistica.rutas.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import ec.edu.uta.logistica.common.config.LogisticaProperties;
import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.entity.EstadoRuta;
import ec.edu.uta.logistica.rutas.entity.Ruta;
import ec.edu.uta.logistica.rutas.repository.CargaRepartidor;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import ec.edu.uta.logistica.seguimiento.evento.RutaActualizadaEvent;
import ec.edu.uta.logistica.seguimiento.service.SeguimientoService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Consultas de rutas e insercion de pedidos de ultimo momento. */
@Service
public class RutaService {

    private final RutaRepository rutaRepository;
    private final PedidoRepository pedidoRepository;
    private final RepartidorRepository repartidorRepository;
    private final BloqueoZonaFecha bloqueo;
    private final SeguimientoService seguimientoService;
    private final ApplicationEventPublisher publicador;
    private final LogisticaProperties propiedades;
    private final EntityManager entityManager;
    private final Clock reloj;

    public RutaService(RutaRepository rutaRepository, PedidoRepository pedidoRepository,
                       RepartidorRepository repartidorRepository, BloqueoZonaFecha bloqueo,
                       SeguimientoService seguimientoService, ApplicationEventPublisher publicador,
                       LogisticaProperties propiedades, EntityManager entityManager, Clock reloj) {
        this.rutaRepository = rutaRepository;
        this.pedidoRepository = pedidoRepository;
        this.repartidorRepository = repartidorRepository;
        this.bloqueo = bloqueo;
        this.seguimientoService = seguimientoService;
        this.publicador = publicador;
        this.propiedades = propiedades;
        this.entityManager = entityManager;
        this.reloj = reloj;
    }

    /** @param fecha si es nula se usa el dia de hoy */
    @Transactional(readOnly = true)
    public List<RutaResponse> listarPorFecha(LocalDate fecha) {
        LocalDate dia = fecha != null ? fecha : LocalDate.now(reloj);
        return rutaRepository.buscarPorFecha(dia).stream().map(RutaResponse::desde).toList();
    }

    @Transactional(readOnly = true)
    public RutaResponse obtener(Long id) {
        return RutaResponse.desde(rutaRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe la ruta con id " + id)));
    }

    /** Ruta que el repartidor debe recorrer: la que esta en curso o, si no hay, la proxima armada. */
    @Transactional(readOnly = true)
    public RutaResponse rutaActualDe(Long repartidorId) {
        List<Ruta> vigentes = rutaRepository.buscarVigentesDeRepartidor(repartidorId, LocalDate.now(reloj),
                EstadoRuta.FINALIZADA);
        Optional<Ruta> actual = vigentes.stream().filter(r -> r.getEstado() == EstadoRuta.EN_CURSO).findFirst()
                .or(() -> vigentes.stream().findFirst());
        return actual.map(RutaResponse::desde).orElseThrow(
                () -> new RecursoNoEncontradoException("El repartidor no tiene una ruta activa"));
    }

    /**
     * Pedido de ultimo momento: lo inserta en una ruta ARMADA de su zona y fecha que tenga espacio (la que tenga
     * la parada mas cercana); si no hay ninguna, crea una ruta nueva. Es seguro ante llamadas simultaneas:
     * ver {@link BloqueoZonaFecha}.
     */
    @Transactional
    public RutaResponse insertarUltimoMomento(Long pedidoId) {
        Pedido pedido = pedidoRepository.findById(pedidoId)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el pedido con id " + pedidoId));
        Long zonaId = pedido.getZona().getId();
        LocalDate fecha = pedido.getFechaEntrega();

        List<Ruta> rutas = bloqueo.bloquear(zonaId, fecha);
        // Con el bloqueo tomado se relee el pedido: otra transaccion pudo asignarlo mientras se esperaba.
        entityManager.refresh(pedido, LockModeType.PESSIMISTIC_WRITE);
        if (pedido.getEstado() != EstadoPedido.PENDIENTE || pedido.getRuta() != null) {
            throw new ConflictoException("PEDIDO_YA_ASIGNADO", "El pedido ya fue asignado a una ruta");
        }

        boolean rutaNueva = false;
        Ruta destino = rutaMasCercanaConEspacio(rutas, pedido).orElse(null);
        if (destino == null) {
            destino = rutaRepository.save(new Ruta(fecha, pedido.getZona(), repartidorConMenosCarga(fecha),
                    propiedades.rutas().maxPedidos()));
            rutaNueva = true;
        }

        destino.agregarPedido(pedido);
        seguimientoService.registrarCambio(pedido.getId(), EstadoPedido.PENDIENTE, pedido.getEstado(),
                OrigenCambio.WEB);
        publicador.publishEvent(new RutaActualizadaEvent(destino.getId(), fecha, destino.getEstado().name(),
                rutaNueva ? "RUTA_NUEVA_ULTIMO_MOMENTO" : "PEDIDO_INSERTADO_ULTIMO_MOMENTO"));
        return RutaResponse.desde(destino);
    }

    private Optional<Ruta> rutaMasCercanaConEspacio(List<Ruta> rutas, Pedido pedido) {
        return rutas.stream()
                .filter(r -> r.getEstado() == EstadoRuta.ARMADA && r.tieneEspacio())
                .min(Comparator.comparingDouble((Ruta r) -> distanciaMinima(r, pedido))
                        .thenComparingInt(r -> r.getPedidos().size())
                        .thenComparing(Ruta::getId));
    }

    private double distanciaMinima(Ruta ruta, Pedido pedido) {
        return ruta.getPedidos().stream()
                .mapToDouble(p -> GeoUtil.distanciaMetros(p.getUbicacion(), pedido.getUbicacion()))
                .min().orElse(0d);
    }

    private Repartidor repartidorConMenosCarga(LocalDate fecha) {
        List<Repartidor> disponibles = repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById();
        if (disponibles.isEmpty()) {
            throw new ReglaNegocioException("SIN_REPARTIDORES", "No hay repartidores disponibles para crear una ruta");
        }
        Map<Long, Long> carga = new HashMap<>();
        for (CargaRepartidor c : rutaRepository.cargaPorRepartidor(fecha)) {
            carga.put(c.repartidorId(), c.pedidos());
        }
        return disponibles.stream()
                .min(Comparator.comparingLong((Repartidor r) -> carga.getOrDefault(r.getId(), 0L))
                        .thenComparing(Repartidor::getId))
                .orElseThrow();
    }
}
