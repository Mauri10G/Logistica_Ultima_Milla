package ec.edu.uta.logistica.zonas.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import ec.edu.uta.logistica.IntegrationTestBase;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Las dos consultas espaciales de las que dependen CP-03 (zona que contiene un punto) y CP-06 a CP-08
 * (superposicion: solo cuentan los interiores que se cruzan), mas la forma de las 5 zonas base de V3.
 */
class ZonaRepositoryIT extends IntegrationTestBase {

    private static final List<String> ZONAS_BASE =
            List.of("Centro", "Ingahurco", "Ficoa/Atocha", "Norte/Izamba", "Sur/Huachi");

    /** Pares de zonas base que son vecinas: deben compartir un borde (tramo de linea) y no dejar hueco. */
    private static final List<List<String>> VECINAS = List.of(
            List.of("Centro", "Ingahurco"), List.of("Centro", "Sur/Huachi"), List.of("Ingahurco", "Ficoa/Atocha"),
            List.of("Ingahurco", "Norte/Izamba"), List.of("Ficoa/Atocha", "Norte/Izamba"));

    /** Igual al valor por defecto de logistica.zonas.tolerancia-superposicion-m2. */
    private static final double TOLERANCIA_M2 = 500d;

    @Autowired
    private ZonaRepository zonaRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private String wkt(double minLng, double minLat, double maxLng, double maxLat) {
        return Fabrica.rectangulo(minLng, minLat, maxLng, maxLat).toText();
    }

    private List<String> superpuestas(String wkt) {
        return zonaRepository.buscarSuperpuestas(wkt, 0L, TOLERANCIA_M2).stream().map(Zona::getNombre).toList();
    }

    private String zonaDe(double latitud, double longitud) {
        return zonaRepository.buscarZonaQueContiene(latitud, longitud).map(Zona::getNombre).orElse(null);
    }

    // ---------------------------------------------------------------- CP-03: zona de un punto

    @Test
    @DisplayName("CP-03: encuentra la zona de un punto dentro de ella")
    void puntoDentroDeUnaZona() {
        assertThat(zonaDe(-1.2412, -78.6197)).isEqualTo("Centro");
        assertThat(zonaDe(-1.2100, -78.6050)).isEqualTo("Norte/Izamba");
    }

    @Test
    @DisplayName("CP-03: un punto fuera de toda zona no tiene zona")
    void puntoFueraDeToda() {
        assertThat(zonaRepository.buscarZonaQueContiene(-1.3000, -78.5000)).isEmpty();
        assertThat(zonaRepository.buscarZonaQueContiene(-1.2700, -78.6150)).isEmpty(); // al sur de Sur/Huachi
        assertThat(zonaRepository.buscarZonaQueContiene(-1.2300, -78.6500)).isEmpty(); // al oeste de Ficoa/Atocha
        assertThat(zonaRepository.buscarZonaQueContiene(-1.2300, -78.5990)).isEmpty(); // al este de Ingahurco
    }

    @Test
    @DisplayName("los puntos del antiguo margen de 200 m entre zonas ya pertenecen a la zona vecina")
    void puntosDelAntiguoMargenTienenZona() {
        assertThat(zonaDe(-1.2350, -78.6170)).isEqualTo("Ingahurco");   // antes entre Centro e Ingahurco
        assertThat(zonaDe(-1.2358, -78.6170)).isEqualTo("Centro");
        assertThat(zonaDe(-1.2300, -78.6255)).isEqualTo("Ficoa/Atocha"); // antes entre Ficoa e Ingahurco
        assertThat(zonaDe(-1.2300, -78.6245)).isEqualTo("Ingahurco");
        assertThat(zonaDe(-1.2235, -78.6150)).isEqualTo("Ingahurco");   // antes entre Ingahurco y Norte
        assertThat(zonaDe(-1.2225, -78.6150)).isEqualTo("Norte/Izamba");
        assertThat(zonaDe(-1.2465, -78.6170)).isEqualTo("Centro");      // antes entre Centro y Sur
        assertThat(zonaDe(-1.2477, -78.6170)).isEqualTo("Sur/Huachi");
    }

    @Test
    @DisplayName("un punto exactamente sobre el borde compartido tambien tiene zona (la de menor id)")
    void puntoSobreElBordeCompartido() {
        // x = -78.6250 es el borde comun de Ingahurco (id 2) y Ficoa/Atocha (id 3)
        Zona ingahurco = zonaRepository.findByNombreIgnoreCase("Ingahurco").orElseThrow();
        Zona ficoa = zonaRepository.findByNombreIgnoreCase("Ficoa/Atocha").orElseThrow();
        String esperada = ingahurco.getId() < ficoa.getId() ? ingahurco.getNombre() : ficoa.getNombre();

        assertThat(zonaDe(-1.2300, -78.6250)).isEqualTo(esperada);
    }

    // ---------------------------------------------------------------- CP-06 a CP-08: superposicion

    @Test
    @DisplayName("CP-06: zonas que se cruzan (interiores que se intersectan) se listan como superpuestas")
    void detectaCruce() {
        // cubre parte de Centro (lat < -1.2354) e Ingahurco (lat > -1.2346)
        assertThat(superpuestas(wkt(-78.6200, -1.2400, -78.6150, -1.2300))).containsExactly("Centro", "Ingahurco");
    }

    @Test
    @DisplayName("una zona contenida dentro de otra se considera superpuesta")
    void detectaZonaDentroDeOtra() {
        assertThat(superpuestas(wkt(-78.6200, -1.2440, -78.6150, -1.2400))).containsExactly("Centro");
    }

    @Test
    @DisplayName("una zona que contiene por completo a otra se considera superpuesta")
    void detectaZonaQueContieneAOtra() {
        assertThat(superpuestas(wkt(-78.6400, -1.2700, -78.6000, -1.2500))).containsExactly("Sur/Huachi");
    }

    @Test
    @DisplayName("una zona igual a otra se considera superpuesta")
    void detectaZonaIdentica() {
        Zona centro = zonaRepository.findByNombreIgnoreCase("Centro").orElseThrow();

        assertThat(superpuestas(centro.getArea().toText())).containsExactly("Centro");
    }

    @Test
    @DisplayName("zonas que solo comparten borde NO se consideran superpuestas")
    void compartirBordeNoEsSuperposicion() {
        // lado este: toca el borde de Centro (x = -78.6050), el de Ingahurco y el de Norte/Izamba (y = -1.2230)
        assertThat(superpuestas(wkt(-78.6050, -1.2474, -78.5900, -1.2230))).isEmpty();
        // lado oeste: comparte el borde superior de Ficoa/Atocha (y = -1.2170) y solo toca a Norte/Izamba en un vertice
        assertThat(superpuestas(wkt(-78.6350, -1.2170, -78.6250, -1.2100))).isEmpty();
    }

    @Test
    @DisplayName("zonas que solo comparten un vertice NO se consideran superpuestas")
    void compartirVerticeNoEsSuperposicion() {
        // la esquina (-78.6420, -1.2354) es un vertice de Ficoa/Atocha
        assertThat(superpuestas(wkt(-78.6520, -1.2454, -78.6420, -1.2354))).isEmpty();
    }

    // Borde este de Centro: x = -78.6050, de lat -1.2474 a -1.2346. Una franja de 0.000002 grados de ancho (~0.22 m)
    // por ~1.2 km de largo (lat -1.2470 a -1.2360) mide unos 270 m2; una de 0.00001 grados (~1.1 m), unos 1350 m2.
    private static final double BORDE_ESTE_CENTRO = -78.6050;

    @Test
    @DisplayName("una franja de superposicion bajo la tolerancia (~270 m2 < 500 m2) se acepta")
    void franjaBajoLaToleranciaSeAcepta() {
        String franja = wkt(BORDE_ESTE_CENTRO - 0.000002, -1.2470, -78.5900, -1.2360);

        assertThat(superpuestas(franja)).isEmpty();
    }

    @Test
    @DisplayName("la misma franja se rechaza si la tolerancia es 0, y una franja sobre la tolerancia (~1350 m2) se rechaza")
    void franjaSobreLaToleranciaSeRechaza() {
        String delgada = wkt(BORDE_ESTE_CENTRO - 0.000002, -1.2470, -78.5900, -1.2360);
        String ancha = wkt(BORDE_ESTE_CENTRO - 0.00001, -1.2470, -78.5900, -1.2360);

        assertThat(zonaRepository.buscarSuperpuestas(delgada, 0L, 0d)).extracting(Zona::getNombre)
                .containsExactly("Centro");
        assertThat(superpuestas(ancha)).containsExactly("Centro");
    }

    @Test
    @DisplayName("un cruce real y una zona diminuta dentro de otra se rechazan")
    void cruceRealYContencionSeRechazan() {
        // cruce real: unos 5 km2 de Centro e Ingahurco, mucho mas que 500 m2
        assertThat(superpuestas(wkt(-78.6200, -1.2400, -78.6150, -1.2300))).containsExactly("Centro", "Ingahurco");
        // una zona diminuta (< 500 m2) totalmente dentro de Centro se rechaza igual
        assertThat(zonaRepository.buscarSuperpuestas(wkt(-78.6150, -1.2420, -78.61499, -1.24199), 0L, TOLERANCIA_M2))
                .extracting(Zona::getNombre).containsExactly("Centro");
        // ... incluso con una tolerancia enorme: contenida es contenida
        assertThat(zonaRepository.buscarSuperpuestas(wkt(-78.6150, -1.2420, -78.61499, -1.24199), 0L, 1e12))
                .extracting(Zona::getNombre).containsExactly("Centro");
    }

    @Test
    @DisplayName("un poligono alejado de las zonas no se superpone con ninguna")
    void sinSuperposicion() {
        assertThat(superpuestas(wkt(-78.50, -1.40, -78.49, -1.39))).isEmpty();
    }

    @Test
    @DisplayName("CP-08: al editar se excluye la propia zona de la comparacion")
    void excluyeLaPropiaZona() {
        Zona centro = zonaRepository.findByNombreIgnoreCase("Centro").orElseThrow();

        assertThat(zonaRepository.buscarSuperpuestas(centro.getArea().toText(), 0L, TOLERANCIA_M2)).extracting(Zona::getNombre)
                .containsExactly("Centro");
        assertThat(zonaRepository.buscarSuperpuestas(centro.getArea().toText(), centro.getId(), TOLERANCIA_M2)).isEmpty();
    }

    // ---------------------------------------------------------------- las 5 zonas base (V3)

    @Test
    @DisplayName("las 5 zonas base no se superponen entre si (solo comparten borde)")
    void zonasBaseSinSuperposicion() {
        for (String nombre : ZONAS_BASE) {
            Zona zona = zonaRepository.findByNombreIgnoreCase(nombre).orElseThrow();
            assertThat(zonaRepository.buscarSuperpuestas(zona.getArea().toText(), zona.getId(), TOLERANCIA_M2))
                    .as("zonas que se superponen con %s", nombre).isEmpty();
        }
    }

    @Test
    @DisplayName("las 5 zonas base no tienen huecos entre vecinas: cada par comparte un borde")
    void zonasBaseVecinasComparteBorde() {
        for (List<String> par : VECINAS) {
            // 'FF*F1****': interiores y bordes-interiores disjuntos y los bordes se tocan en una LINEA (dimension 1)
            Boolean tocanEnLinea = jdbc.queryForObject("""
                    SELECT ST_Relate(a.area, b.area, 'FF*F1****') FROM zona a, zona b
                    WHERE a.nombre = ? AND b.nombre = ?""", Boolean.class, par.get(0), par.get(1));
            assertThat(tocanEnLinea).as("%s y %s comparten borde", par.get(0), par.get(1)).isTrue();
        }
    }

    @Test
    @DisplayName("las 5 zonas base forman un solo bloque sin huecos internos y sin areas dobles")
    void zonasBaseFormanUnBloqueSinHuecos() {
        Map<String, Object> bloque = jdbc.queryForMap("""
                SELECT ST_NumGeometries(u.g) AS partes,
                       ST_NumInteriorRings(ST_GeometryN(u.g, 1)) AS huecos,
                       ST_Area(u.g) AS area_union,
                       u.suma AS suma_areas
                FROM (SELECT ST_Union(area) AS g, SUM(ST_Area(area)) AS suma
                      FROM zona WHERE nombre IN ('Centro', 'Ingahurco', 'Ficoa/Atocha', 'Norte/Izamba', 'Sur/Huachi')) u
                """);

        assertThat(((Number) bloque.get("partes")).intValue()).as("bloques separados").isEqualTo(1);
        assertThat(((Number) bloque.get("huecos")).intValue()).as("huecos internos").isZero();
        // si dos zonas ocuparan la misma superficie, la suma de areas superaria a la de la union
        assertThat(((Number) bloque.get("suma_areas")).doubleValue())
                .isCloseTo(((Number) bloque.get("area_union")).doubleValue(), org.assertj.core.data.Offset.offset(1e-12));
    }

    @Test
    @DisplayName("V3: todos los pedidos de los datos base siguen dentro de su misma zona (ST_Contains)")
    void pedidosBaseSiguenEnSuZona() {
        Integer total = jdbc.queryForObject("""
                SELECT count(*) FROM pedido p JOIN cliente c ON c.id = p.cliente_id
                WHERE c.nombres IN ('Maria Torres', 'Jorge Altamirano', 'Sofia Paredes', 'Pedro Lopez', 'Lucia Freire',
                                    'Ricardo Mora', 'Elena Guevara', 'Hugo Ramos', 'Camila Pazmino', 'Daniel Chiluisa')
                  AND p.direccion NOT LIKE 'Direccion %'""", Integer.class);
        Integer fuera = jdbc.queryForObject("""
                SELECT count(*) FROM pedido p
                JOIN cliente c ON c.id = p.cliente_id
                JOIN zona z ON z.id = p.zona_id
                WHERE c.nombres IN ('Maria Torres', 'Jorge Altamirano', 'Sofia Paredes', 'Pedro Lopez', 'Lucia Freire',
                                    'Ricardo Mora', 'Elena Guevara', 'Hugo Ramos', 'Camila Pazmino', 'Daniel Chiluisa')
                  AND p.direccion NOT LIKE 'Direccion %'
                  AND NOT ST_Contains(z.area, p.ubicacion)""", Integer.class);

        assertThat(total).as("pedidos base").isGreaterThanOrEqualTo(20);
        assertThat(fuera).as("pedidos base fuera de su zona").isZero();
    }
}
