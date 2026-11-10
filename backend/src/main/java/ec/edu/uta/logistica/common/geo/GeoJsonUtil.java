package ec.edu.uta.logistica.common.geo;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.LinearRing;
import org.locationtech.jts.geom.Polygon;

/**
 * Conversion entre GeoJSON (Map) y Polygon de JTS, sin depender de librerias externas.
 * Acepta una geometria {@code Polygon} o un {@code Feature} cuya geometria sea un Polygon.
 */
public final class GeoJsonUtil {

    private GeoJsonUtil() {
    }

    public static Polygon aPoligono(Map<String, Object> geojson) {
        if (geojson == null) {
            throw invalido("El area es obligatoria");
        }
        Object tipo = geojson.get("type");
        if ("Feature".equals(tipo) && geojson.get("geometry") instanceof Map<?, ?> geometria) {
            @SuppressWarnings("unchecked")
            Map<String, Object> interna = (Map<String, Object>) geometria;
            return aPoligono(interna);
        }
        if (!"Polygon".equals(tipo)) {
            throw invalido("El area debe ser un GeoJSON de tipo Polygon");
        }
        if (!(geojson.get("coordinates") instanceof List<?> anillos) || anillos.isEmpty()) {
            throw invalido("El Polygon no tiene coordenadas");
        }
        LinearRing exterior = anillo(anillos.get(0));
        LinearRing[] huecos = new LinearRing[anillos.size() - 1];
        for (int i = 1; i < anillos.size(); i++) {
            huecos[i - 1] = anillo(anillos.get(i));
        }
        Polygon poligono = GeoUtil.fabrica().createPolygon(exterior, huecos);
        poligono.setSRID(GeoUtil.SRID);
        if (!poligono.isValid()) {
            throw invalido("El poligono no es valido (auto-interseccion o anillos mal formados)");
        }
        return poligono;
    }

    public static Map<String, Object> aGeoJson(Polygon poligono) {
        List<List<List<Double>>> anillos = new ArrayList<>();
        anillos.add(coordenadas(poligono.getExteriorRing()));
        for (int i = 0; i < poligono.getNumInteriorRing(); i++) {
            anillos.add(coordenadas(poligono.getInteriorRingN(i)));
        }
        return Map.of("type", "Polygon", "coordinates", anillos);
    }

    private static LinearRing anillo(Object anillo) {
        if (!(anillo instanceof List<?> puntos) || puntos.size() < 4) {
            throw invalido("Cada anillo del Polygon necesita al menos 4 puntos");
        }
        Coordinate[] coordenadas = new Coordinate[puntos.size()];
        for (int i = 0; i < puntos.size(); i++) {
            if (!(puntos.get(i) instanceof List<?> par) || par.size() < 2
                    || !(par.get(0) instanceof Number x) || !(par.get(1) instanceof Number y)) {
                throw invalido("Cada punto debe ser [longitud, latitud]");
            }
            double longitud = x.doubleValue();
            double latitud = y.doubleValue();
            if (longitud < -180 || longitud > 180 || latitud < -90 || latitud > 90) {
                throw invalido("Coordenada fuera de rango: [" + longitud + ", " + latitud + "]");
            }
            coordenadas[i] = new Coordinate(longitud, latitud);
        }
        if (!coordenadas[0].equals2D(coordenadas[coordenadas.length - 1])) {
            throw invalido("El anillo del Polygon debe cerrarse (primer y ultimo punto iguales)");
        }
        return GeoUtil.fabrica().createLinearRing(coordenadas);
    }

    private static List<List<Double>> coordenadas(LineString anillo) {
        List<List<Double>> puntos = new ArrayList<>();
        for (Coordinate c : anillo.getCoordinates()) {
            puntos.add(List.of(c.x, c.y));
        }
        return puntos;
    }

    private static SolicitudInvalidaException invalido(String mensaje) {
        return new SolicitudInvalidaException(mensaje);
    }
}
