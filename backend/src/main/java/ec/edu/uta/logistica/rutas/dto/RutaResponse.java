package ec.edu.uta.logistica.rutas.dto;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.pedidos.dto.PedidoResponse;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
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
        return desde(ruta, ruta.getPedidos());
    }

    /**
     * Igual que {@link #desde(Ruta)} pero con los pedidos ya cargados (en orden de visita), sin recorrer la coleccion
     * perezosa de la ruta. Lo usa el listado por fecha para no consultar los pedidos ruta por ruta.
     */
    public static RutaResponse desde(Ruta ruta, List<Pedido> pedidos) {
        return new RutaResponse(
                ruta.getId(),
                ruta.getFecha(),
                ruta.getZona().getId(),
                ruta.getZona().getNombre(),
                ruta.getRepartidor().getId(),
                ruta.getRepartidor().getNombres(),
                ruta.getEstado(),
                ruta.getMaxPedidos(),
                pedidos.stream().map(PedidoResponse::desde).toList());
    }
}
