package ec.edu.uta.logistica.pedidos.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.dto.EstadoPedidoRequest;
import ec.edu.uta.logistica.pedidos.dto.HoraServidorResponse;
import ec.edu.uta.logistica.pedidos.dto.PedidoRequest;
import ec.edu.uta.logistica.pedidos.dto.PedidoResponse;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.repository.ClienteRepository;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.seguimiento.service.SeguimientoService;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.locationtech.jts.geom.Point;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PedidoService {

    private static final DateTimeFormatter HORA_MINUTOS = DateTimeFormatter.ofPattern("HH:mm");

    private final PedidoRepository pedidoRepository;
    private final ClienteRepository clienteRepository;
    private final ZonaRepository zonaRepository;
    private final SeguimientoService seguimientoService;
    private final Clock reloj;
    private final int anticipacionMinimaMinutos;

    /**
     * @param anticipacionMinimaMinutos minutos que debe haber entre la hora actual del servidor y la hora de entrega
     *                                  ({@code logistica.pedidos.anticipacion-minima-minutos}, 30 por defecto)
     */
    public PedidoService(PedidoRepository pedidoRepository, ClienteRepository clienteRepository,
                         ZonaRepository zonaRepository, SeguimientoService seguimientoService, Clock reloj,
                         @Value("${logistica.pedidos.anticipacion-minima-minutos:30}") int anticipacionMinimaMinutos) {
        this.pedidoRepository = pedidoRepository;
        this.clienteRepository = clienteRepository;
        this.zonaRepository = zonaRepository;
        this.seguimientoService = seguimientoService;
        this.reloj = reloj;
        this.anticipacionMinimaMinutos = Math.max(anticipacionMinimaMinutos, 0);
    }

    @Transactional
    public PedidoResponse registrar(PedidoRequest solicitud) {
        validarEntrega(solicitud.fechaEntrega(), solicitud.horaEntrega());
        Point ubicacion = GeoUtil.punto(solicitud.latitud(), solicitud.longitud());
        Zona zona = calcularZona(solicitud.latitud(), solicitud.longitud());
        Cliente cliente = resolverClienteNuevo(solicitud);

        Pedido pedido = new Pedido(cliente, solicitud.direccion().trim(), ubicacion, zona,
                solicitud.fechaEntrega(), solicitud.horaEntrega(), LocalDateTime.now(reloj),
                solicitud.prioridad(), solicitud.registradoPorPersonal() == null || solicitud.registradoPorPersonal());
        return PedidoResponse.desde(pedidoRepository.save(pedido));
    }

    @Transactional
    public PedidoResponse editar(Long id, PedidoRequest solicitud) {
        Pedido pedido = buscar(id);
        pedido.exigirEditable(); // CP-05
        validarEntrega(solicitud.fechaEntrega(), solicitud.horaEntrega());
        Point ubicacion = GeoUtil.punto(solicitud.latitud(), solicitud.longitud());
        Zona zona = calcularZona(solicitud.latitud(), solicitud.longitud());
        Cliente cliente = resolverClienteEdicion(pedido, solicitud);

        pedido.actualizarDatos(cliente, solicitud.direccion().trim(), ubicacion, zona, solicitud.fechaEntrega(),
                solicitud.horaEntrega(), solicitud.prioridad());
        return PedidoResponse.desde(pedidoRepository.save(pedido));
    }

    @Transactional(readOnly = true)
    public PedidoResponse obtener(Long id) {
        return PedidoResponse.desde(buscar(id));
    }

    /** Devuelve la pagina solicitada; el total sale en la cabecera X-Total-Count. */
    @Transactional(readOnly = true)
    public Page<PedidoResponse> listar(LocalDate fecha, Long zonaId, EstadoPedido estado, int pagina, int tamano) {
        int tamanoSeguro = Math.min(Math.max(tamano, 1), 1000);
        return pedidoRepository.buscar(fecha, zonaId, estado, PageRequest.of(Math.max(pagina, 0), tamanoSeguro))
                .map(PedidoResponse::desde);
    }

    @Transactional
    public void eliminar(Long id) {
        Pedido pedido = buscar(id);
        pedido.exigirEditable();
        pedidoRepository.delete(pedido);
    }

    /** PATCH /api/pedidos/{id}/estado: valida la transicion, guarda el historial y notifica por WebSocket. */
    @Transactional
    public PedidoResponse cambiarEstado(Long id, EstadoPedidoRequest solicitud) {
        Pedido pedido = buscar(id);
        if (solicitud.estado() == EstadoPedido.ASIGNADO) {
            throw new ReglaNegocioException("ESTADO_NO_PERMITIDO",
                    "El estado ASIGNADO solo se establece al asignar el pedido a una ruta");
        }
        EstadoPedido anterior = pedido.getEstado();
        pedido.cambiarEstado(solicitud.estado()); // lanza TransicionInvalidaException si no es el siguiente estado
        pedidoRepository.saveAndFlush(pedido);
        seguimientoService.registrarCambio(pedido.getId(), anterior, pedido.getEstado(), solicitud.origenOWeb());
        return PedidoResponse.desde(pedido);
    }

    /** Hora actual del servidor (America/Guayaquil) y anticipacion minima: GET /api/servidor/hora. */
    public HoraServidorResponse horaServidor() {
        LocalDateTime ahora = ahoraEnMinutos();
        LocalDateTime minima = ahora.plusMinutes(anticipacionMinimaMinutos);
        return new HoraServidorResponse(ahora.toLocalDate(), ahora.toLocalTime(), reloj.getZone().getId(),
                anticipacionMinimaMinutos, minima.toLocalDate(), minima.toLocalTime());
    }

    /**
     * CP-04: la fecha de entrega no puede ser anterior a hoy. Ademas, la fecha y hora de entrega deben ser al menos
     * {@code anticipacionMinimaMinutos} despues de ahora. Ahora sale siempre del Clock del backend, nunca del cliente.
     */
    private void validarEntrega(LocalDate fechaEntrega, LocalTime horaEntrega) {
        LocalDateTime ahora = ahoraEnMinutos();
        if (fechaEntrega.isBefore(ahora.toLocalDate())) {
            throw new ReglaNegocioException("FECHA_ENTREGA_PASADA", "La fecha de entrega no puede ser anterior a hoy");
        }
        if (LocalDateTime.of(fechaEntrega, horaEntrega).isBefore(ahora.plusMinutes(anticipacionMinimaMinutos))) {
            throw new ReglaNegocioException("HORA_ENTREGA_INVALIDA", "La hora de entrega debe ser al menos "
                    + anticipacionMinimaMinutos + " minutos después de la hora actual del servidor, "
                    + ahora.toLocalTime().format(HORA_MINUTOS));
        }
    }

    /** Ahora segun el reloj del backend, sin segundos: la hora de entrega del pedido tambien es de precision minuto. */
    private LocalDateTime ahoraEnMinutos() {
        return LocalDateTime.now(reloj).truncatedTo(ChronoUnit.MINUTES);
    }

    /** CP-03: la zona se calcula con ST_Contains del punto. */
    private Zona calcularZona(double latitud, double longitud) {
        return zonaRepository.buscarZonaQueContiene(latitud, longitud)
                .orElseThrow(DireccionFueraDeZonaException::new);
    }

    private Cliente resolverClienteNuevo(PedidoRequest solicitud) {
        if (solicitud.clienteId() != null) {
            return buscarCliente(solicitud.clienteId());
        }
        exigirDatosCliente(solicitud);
        return clienteRepository.save(new Cliente(solicitud.clienteNombres().trim(),
                solicitud.clienteTelefono().trim(), vacioANulo(solicitud.clienteEmail())));
    }

    private Cliente resolverClienteEdicion(Pedido pedido, PedidoRequest solicitud) {
        if (solicitud.clienteId() != null) {
            return buscarCliente(solicitud.clienteId());
        }
        Cliente actual = pedido.getCliente();
        if (tieneTexto(solicitud.clienteNombres()) && tieneTexto(solicitud.clienteTelefono())) {
            actual.actualizar(solicitud.clienteNombres().trim(), solicitud.clienteTelefono().trim(),
                    vacioANulo(solicitud.clienteEmail()));
        }
        return actual;
    }

    private void exigirDatosCliente(PedidoRequest solicitud) {
        if (!tieneTexto(solicitud.clienteNombres()) || !tieneTexto(solicitud.clienteTelefono())) {
            throw new SolicitudInvalidaException(
                    "Indique clienteId o, para un cliente nuevo, clienteNombres y clienteTelefono");
        }
    }

    private Cliente buscarCliente(Long clienteId) {
        return clienteRepository.findById(clienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el cliente con id " + clienteId));
    }

    private Pedido buscar(Long id) {
        return pedidoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el pedido con id " + id));
    }

    private static boolean tieneTexto(String texto) {
        return texto != null && !texto.isBlank();
    }

    private static String vacioANulo(String texto) {
        return tieneTexto(texto) ? texto.trim() : null;
    }
}
