package ec.edu.uta.logistica.rutas.service;

import java.time.LocalDate;
import java.util.HashMap;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Arma las rutas de una fecha. Se dispara manualmente (POST /api/rutas/armar) o por el scheduler.
 *
 * <p>Concurrencia: toda la operacion es una sola transaccion. Primero se bloquean las zonas implicadas
 * (en orden ascendente de id) y solo DESPUES se leen los pedidos pendientes, para no trabajar con datos que otra
 * transaccion ya asigno.
 */
@Service
public class ArmadoRutasService {

    private final PedidoRepository pedidoRepository;
    private final RepartidorRepository repartidorRepository;
    private final RutaRepository rutaRepository;
    private final BloqueoZonaFecha bloqueo;
    private final EstrategiaArmadoRutas estrategia;
    private final SeguimientoService seguimientoService;
    private final ApplicationEventPublisher publicador;
    private final LogisticaProperties propiedades;

    public ArmadoRutasService(PedidoRepository pedidoRepository, RepartidorRepository repartidorRepository,
                              RutaRepository rutaRepository, BloqueoZonaFecha bloqueo,
                              EstrategiaArmadoRutas estrategia, SeguimientoService seguimientoService,
                              ApplicationEventPublisher publicador, LogisticaProperties propiedades) {
        this.pedidoRepository = pedidoRepository;
        this.repartidorRepository = repartidorRepository;
        this.rutaRepository = rutaRepository;
        this.bloqueo = bloqueo;
        this.estrategia = estrategia;
        this.seguimientoService = seguimientoService;
        this.publicador = publicador;
        this.propiedades = propiedades;
    }

    /** @return las rutas nuevas (vacio si no habia pedidos pendientes) */
    @Transactional
    public List<RutaResponse> armar(LocalDate fecha) {
        // 1) Solo ids de zona: no se cargan entidades antes de tener los bloqueos.
        List<Long> zonaIds = pedidoRepository.zonaIdsConPendientes(fecha, EstadoPedido.PENDIENTE);
        if (zonaIds.isEmpty()) {
            return List.of();
        }
        // 2) Bloqueo en orden ascendente (la consulta ya viene ordenada) -> sin interbloqueos entre armados.
        zonaIds.forEach(zonaId -> bloqueo.bloquear(zonaId, fecha));

        // 3) Datos frescos, ya con los bloqueos tomados.
        List<Pedido> pendientes = pedidoRepository.buscarSinRuta(fecha, EstadoPedido.PENDIENTE);
        if (pendientes.isEmpty()) {
            return List.of();
        }
        List<Repartidor> disponibles = repartidorRepository.findByActivoTrueAndDisponibleTrueOrderById();
        if (disponibles.isEmpty()) {
            throw new ReglaNegocioException("SIN_REPARTIDORES", "No hay repartidores disponibles para armar rutas");
        }

        int maxPedidos = propiedades.rutas().maxPedidos();
        List<RutaPlanificada> planes = estrategia.planificar(pendientes, disponibles, cargaActual(fecha), maxPedidos);

        List<Ruta> creadas = planes.stream().map(plan -> persistir(fecha, plan, maxPedidos)).toList();
        publicador.publishEvent(new RutasArmadasEvent(fecha, creadas.stream().map(Ruta::getId).toList()));
        return creadas.stream().map(RutaResponse::desde).toList();
    }

    private Ruta persistir(LocalDate fecha, RutaPlanificada plan, int maxPedidos) {
        Ruta ruta = rutaRepository.save(new Ruta(fecha, plan.zona(), plan.repartidor(), maxPedidos));
        for (Pedido pedido : plan.paradas()) {
            EstadoPedido anterior = pedido.getEstado();
            ruta.agregarPedido(pedido);
            seguimientoService.registrarCambio(pedido.getId(), anterior, pedido.getEstado(), OrigenCambio.WEB);
        }
        return ruta;
    }

    private Map<Long, Integer> cargaActual(LocalDate fecha) {
        Map<Long, Integer> carga = new HashMap<>();
        for (CargaRepartidor c : rutaRepository.cargaPorRepartidor(fecha)) {
            carga.put(c.repartidorId(), Math.toIntExact(c.pedidos()));
        }
        return carga;
    }
}
