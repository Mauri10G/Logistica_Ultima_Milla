package ec.edu.uta.logistica.common.geo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.locationtech.jts.geom.Polygon;

/** Conversion GeoJSON <-> Polygon y todas sus validaciones (400 SOLICITUD_INVALIDA). */
class GeoJsonUtilTest {

    private static final List<List<Double>> CUADRADO = List.of(List.of(-78.62, -1.24), List.of(-78.61, -1.24),
            List.of(-78.61, -1.23), List.of(-78.62, -1.23), List.of(-78.62, -1.24));
    private static final List<List<Double>> HUECO = List.of(List.of(-78.618, -1.238), List.of(-78.612, -1.238),
            List.of(-78.612, -1.232), List.of(-78.618, -1.232), List.of(-78.618, -1.238));

    private static Map<String, Object> poligono(Object coordenadas) {
        return Map.of("type", "Polygon", "coordinates", coordenadas);
    }

    @Test
    @DisplayName("un Polygon valido se convierte con SRID 4326 y vuelve al mismo GeoJSON")
    void idaYVuelta() {
        Polygon poligono = GeoJsonUtil.aPoligono(poligono(List.of(CUADRADO)));

        assertThat(poligono.getSRID()).isEqualTo(GeoUtil.SRID);
        assertThat(poligono.getNumInteriorRing()).isZero();
        assertThat(GeoJsonUtil.aGeoJson(poligono)).isEqualTo(poligono(List.of(CUADRADO)));
    }

    @Test
    @DisplayName("acepta un Feature cuya geometria es un Polygon, y respeta los huecos")
    void featureConHueco() {
        Map<String, Object> feature = Map.of("type", "Feature", "properties", Map.of(),
                "geometry", poligono(List.of(CUADRADO, HUECO)));

        Polygon poligono = GeoJsonUtil.aPoligono(feature);

        assertThat(poligono.getNumInteriorRing()).isEqualTo(1);
        assertThat(GeoJsonUtil.aGeoJson(poligono).get("coordinates")).isEqualTo(List.of(CUADRADO, HUECO));
    }

    static List<Object[]> invalidos() {
        List<List<Double>> abierto = CUADRADO.subList(0, 4);
        List<List<Double>> cruzado = List.of(List.of(0d, 0d), List.of(1d, 1d), List.of(1d, 0d), List.of(0d, 1d),
                List.of(0d, 0d));
        return List.of(
                new Object[]{"tipo Point", Map.of("type", "Point", "coordinates", List.of(0, 0)), "Polygon"},
                new Object[]{"Feature sin geometria", Map.of("type", "Feature"), "Polygon"},
                new Object[]{"sin coordenadas", Map.of("type", "Polygon"), "coordenadas"},
                new Object[]{"coordenadas vacias", poligono(List.of()), "coordenadas"},
                new Object[]{"anillo de 3 puntos", poligono(List.of(CUADRADO.subList(0, 3))), "4 puntos"},
                new Object[]{"anillo que no es lista", poligono(List.of("x")), "4 puntos"},
                new Object[]{"punto con un solo numero", poligono(List.of(List.of(List.of(1d), List.of(1d, 1d),
                        List.of(2d, 2d), List.of(1d)))), "[longitud, latitud]"},
                new Object[]{"punto con texto", poligono(List.of(List.of(List.of("a", "b"), List.of(1d, 1d),
                        List.of(2d, 2d), List.of("a", "b")))), "[longitud, latitud]"},
                new Object[]{"longitud fuera de rango", poligono(List.of(List.of(List.of(-181d, 0d), List.of(1d, 0d),
                        List.of(1d, 1d), List.of(-181d, 0d)))), "fuera de rango"},
                new Object[]{"latitud fuera de rango", poligono(List.of(List.of(List.of(0d, 91d), List.of(1d, 0d),
                        List.of(1d, 1d), List.of(0d, 91d)))), "fuera de rango"},
                new Object[]{"anillo sin cerrar", poligono(List.of(abierto)), "cerrarse"},
                new Object[]{"poligono que se cruza a si mismo", poligono(List.of(cruzado)), "no es valido"});
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidos")
    @DisplayName("GeoJSON invalido -> SolicitudInvalidaException con un mensaje claro")
    void geoJsonInvalido(String caso, Map<String, Object> geojson, String mensaje) {
        assertThatThrownBy(() -> GeoJsonUtil.aPoligono(geojson))
                .isInstanceOf(SolicitudInvalidaException.class).hasMessageContaining(mensaje);
    }

    @Test
    @DisplayName("sin area -> 'El area es obligatoria'")
    void sinArea() {
        assertThatThrownBy(() -> GeoJsonUtil.aPoligono(null)).isInstanceOf(SolicitudInvalidaException.class)
                .hasMessage("El area es obligatoria");
    }

    @Test
    @DisplayName("GeoUtil: distancia haversine conocida y punto en orden (lat, lng)")
    void geoUtil() {
        var a = GeoUtil.punto(-1.24, -78.62);
        var b = GeoUtil.punto(-1.24, -78.61);

        assertThat(GeoUtil.latitud(a)).isEqualTo(-1.24);
        assertThat(GeoUtil.longitud(a)).isEqualTo(-78.62);
        // 0.01 grados de longitud en el ecuador son ~1.11 km
        assertThat(GeoUtil.distanciaMetros(a, b)).isBetween(1100d, 1120d);
        assertThat(GeoUtil.distanciaMetros(a, a)).isZero();
    }
}
