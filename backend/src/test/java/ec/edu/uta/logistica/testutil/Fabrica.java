package ec.edu.uta.logistica.testutil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Polygon;
import org.springframework.test.util.ReflectionTestUtils;

/** Crea entidades en memoria (sin base de datos) para las pruebas unitarias. */
public final class Fabrica {

    private Fabrica() {
    }

    public static Polygon rectangulo(double minLng, double minLat, double maxLng, double maxLat) {
        Polygon poligono = GeoUtil.fabrica().createPolygon(new Coordinate[]{
                new Coordinate(minLng, minLat), new Coordinate(maxLng, minLat),
                new Coordinate(maxLng, maxLat), new Coordinate(minLng, maxLat),
                new Coordinate(minLng, minLat)});
        poligono.setSRID(GeoUtil.SRID);
        return poligono;
    }

    public static Zona zona(Long id, String nombre) {
        Zona zona = new Zona(nombre, rectangulo(-78.63, -1.25, -78.61, -1.23), true);
        ReflectionTestUtils.setField(zona, "id", id);
        return zona;
    }

    public static Repartidor repartidor(Long id, String nombres) {
        Repartidor repartidor = new Repartidor(nombres, "0990000000", true, 4);
        ReflectionTestUtils.setField(repartidor, "id", id);
        return repartidor;
    }

    public static Pedido pedido(Long id, Zona zona, LocalDate fechaEntrega, LocalTime hora, double lat, double lng) {
        Cliente cliente = new Cliente("Cliente " + id, "0980000000", null);
        Pedido pedido = new Pedido(cliente, "Direccion " + id, GeoUtil.punto(lat, lng), zona, fechaEntrega, hora,
                LocalDateTime.of(2026, 1, 1, 8, 0), PrioridadPedido.NORMAL, true);
        ReflectionTestUtils.setField(pedido, "id", id);
        return pedido;
    }

    public static Pedido pedido(Long id, Zona zona, LocalDate fechaEntrega) {
        return pedido(id, zona, fechaEntrega, LocalTime.of(10, 0), -1.24 + id * 0.0001, -78.62);
    }
}
