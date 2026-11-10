package ec.edu.uta.logistica.rutas.dto;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.pedidos.dto.PedidoResponse;
import ec.edu.uta.logistica.rutas.entity.EstadoRuta;
import ec.edu.uta.logistica.rutas.entity.Ruta;

/** Ruta con sus pedidos en el orden de visita. */
public record RutaResponse(
        Long id,
        LocalDate fecha,
        Long zonaId,
        String zonaNombre,
        Long repartidorId,
        String repartidorNombre,
        EstadoRuta estado,
        int maxPedidos,
        List<PedidoResponse> pedidos) {

    public static RutaResponse desde(Ruta ruta) {
        return new RutaResponse(
                ruta.getId(),
                ruta.getFecha(),
                ruta.getZona().getId(),
                ruta.getZona().getNombre(),
                ruta.getRepartidor().getId(),
                ruta.getRepartidor().getNombres(),
                ruta.getEstado(),
                ruta.getMaxPedidos(),
                ruta.getPedidos().stream().map(PedidoResponse::desde).toList());
    }
}
