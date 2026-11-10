package ec.edu.uta.logistica.pedidos.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;

public record PedidoResponse(
        Long id,
        Long clienteId,
        String clienteNombres,
        String clienteTelefono,
        String direccion,
        double latitud,
        double longitud,
        Long zonaId,
        String zonaNombre,
        LocalDate fechaEntrega,
        LocalTime horaEntrega,
        LocalDateTime fechaRegistro,
        PrioridadPedido prioridad,
        EstadoPedido estado,
        boolean registradoPorPersonal,
        Long rutaId,
        Integer ordenEnRuta,
        Long version) {

    public static PedidoResponse desde(Pedido p) {
        return new PedidoResponse(
                p.getId(),
                p.getCliente().getId(),
                p.getCliente().getNombres(),
                p.getCliente().getTelefono(),
                p.getDireccion(),
                p.getUbicacion().getY(),
                p.getUbicacion().getX(),
                p.getZona().getId(),
                p.getZona().getNombre(),
                p.getFechaEntrega(),
                p.getHoraEntrega(),
                p.getFechaRegistro(),
                p.getPrioridad(),
                p.getEstado(),
                p.isRegistradoPorPersonal(),
                p.getRuta() != null ? p.getRuta().getId() : null,
                p.getOrdenEnRuta(),
                p.getVersion());
    }
}
