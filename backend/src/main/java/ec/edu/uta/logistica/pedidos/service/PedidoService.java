package ec.edu.uta.logistica.pedidos.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;

import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.dto.EstadoPedidoRequest;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PedidoService {

    private final PedidoRepository pedidoRepository;
    private final ClienteRepository clienteRepository;
    private final ZonaRepository zonaRepository;
    private final SeguimientoService seguimientoService;
    private final Clock reloj;

    public PedidoService(PedidoRepository pedidoRepository, ClienteRepository clienteRepository,
                         ZonaRepository zonaRepository, SeguimientoService seguimientoService, Clock reloj) {
        this.pedidoRepository = pedidoRepository;
        this.clienteRepository = clienteRepository;
        this.zonaRepository = zonaRepository;
        this.seguimientoService = seguimientoService;
        this.reloj = reloj;
    }

    @Transactional
    public PedidoResponse registrar(PedidoRequest solicitud) {
        validarFechaEntrega(solicitud.fechaEntrega());
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
        validarFechaEntrega(solicitud.fechaEntrega());
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

    /** CP-04: no se permite una fecha de entrega anterior a hoy. */
    private void validarFechaEntrega(LocalDate fechaEntrega) {
        if (fechaEntrega.isBefore(LocalDate.now(reloj))) {
            throw new ReglaNegocioException("FECHA_ENTREGA_PASADA", "La fecha de entrega no puede ser anterior a hoy");
        }
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
