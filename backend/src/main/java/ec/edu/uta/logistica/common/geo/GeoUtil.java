package ec.edu.uta.logistica.common.geo;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

/**
 * Utilidades geograficas. Convencion JTS/PostGIS: x = longitud, y = latitud, SRID 4326 (WGS84).
 */
public final class GeoUtil {

    public static final int SRID = 4326;
    private static final double RADIO_TIERRA_METROS = 6_371_000d;
    private static final GeometryFactory FABRICA = new GeometryFactory(new PrecisionModel(), SRID);

    private GeoUtil() {
    }

    public static GeometryFactory fabrica() {
        return FABRICA;
    }

    public static Point punto(double latitud, double longitud) {
        return FABRICA.createPoint(new Coordinate(longitud, latitud));
    }

    public static double latitud(Point punto) {
        return punto.getY();
    }

    public static double longitud(Point punto) {
        return punto.getX();
    }

    /** Distancia haversine en metros entre dos puntos WGS84. */
    public static double distanciaMetros(Point a, Point b) {
        double lat1 = Math.toRadians(a.getY());
        double lat2 = Math.toRadians(b.getY());
        double dLat = lat2 - lat1;
        double dLng = Math.toRadians(b.getX() - a.getX());
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * RADIO_TIERRA_METROS * Math.asin(Math.min(1d, Math.sqrt(h)));
    }
}
