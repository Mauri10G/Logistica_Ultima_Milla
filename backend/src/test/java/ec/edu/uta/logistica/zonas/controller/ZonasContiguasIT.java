package ec.edu.uta.logistica.zonas.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import com.jayway.jsonpath.JsonPath;
import ec.edu.uta.logistica.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Regla de superposicion por HTTP contra PostGIS real: las zonas pueden compartir borde o vertices; solo se rechazan
 * si sus interiores se cruzan (cruce parcial, zona dentro de otra o zona que contiene a otra).
 * Usa una region lejana (lng -60, lat 10) para no interferir con las zonas base ni con otras pruebas.
 */
class ZonasContiguasIT extends IntegrationTestBase {

    @Autowired
    private MockMvc mvc;

    @Value("${logistica.zonas.tolerancia-superposicion-m2}")
    private double toleranciaM2;

    private final List<Long> creadas = new ArrayList<>();

    @AfterEach
    void darDeBajaLasZonasCreadas() throws Exception {
        for (Long id : creadas) {
            mvc.perform(delete("/api/zonas/" + id)).andExpect(status().isNoContent());
        }
    }

    private static String zona(String nombre, double minLng, double minLat, double maxLng, double maxLat) {
        return """
                {"nombre": "%s", "area": {"type": "Polygon", "coordinates": [[[%s,%s],[%s,%s],[%s,%s],[%s,%s],[%s,%s]]]}}
                """.formatted(nombre, minLng, minLat, maxLng, minLat, maxLng, maxLat, minLng, maxLat, minLng, minLat);
    }

    private ResultActions enviar(String cuerpo) throws Exception {
        return mvc.perform(post("/api/zonas").contentType(MediaType.APPLICATION_JSON).content(cuerpo));
    }

    private long crear(String cuerpo) throws Exception {
        String respuesta = enviar(cuerpo).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(respuesta, "$.id")).longValue();
        creadas.add(id);
        return id;
    }

    @Test
    @DisplayName("zonas que comparten borde o solo un vertice se aceptan")
    void compartirBordeOVerticeSeAcepta() throws Exception {
        crear(zona("IT-Cont-A", -60.00, 10.00, -59.90, 10.10));
        // comparte todo el borde este de A
        long b = crear(zona("IT-Cont-B", -59.90, 10.00, -59.80, 10.10));
        // toca a A solo en el vertice (-60.00, 10.10)
        crear(zona("IT-Cont-C", -60.10, 10.10, -60.00, 10.20));

        // editar una zona que comparte borde con otra tampoco la considera superpuesta (ni a si misma)
        mvc.perform(put("/api/zonas/" + b).contentType(MediaType.APPLICATION_JSON)
                .content(zona("IT-Cont-B", -59.90, 10.00, -59.80, 10.10))).andExpect(status().isOk());
    }

    @Test
    @DisplayName("zonas que se cruzan se rechazan con ZONA_SUPERPUESTA y se nombran las zonas en conflicto")
    void cruceSeRechaza() throws Exception {
        crear(zona("IT-Cruce-A", -60.00, 10.00, -59.90, 10.10));
        crear(zona("IT-Cruce-B", -59.90, 10.00, -59.80, 10.10));

        enviar(zona("IT-Cruce-D", -59.95, 10.05, -59.85, 10.15)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ZONA_SUPERPUESTA"))
                .andExpect(jsonPath("$.mensaje").value(containsString("IT-Cruce-A, IT-Cruce-B")));
    }

    @Test
    @DisplayName("una zona dentro de otra se rechaza con ZONA_SUPERPUESTA")
    void zonaDentroDeOtraSeRechaza() throws Exception {
        crear(zona("IT-Dentro-A", -60.00, 10.00, -59.90, 10.10));

        enviar(zona("IT-Dentro-E", -59.97, 10.02, -59.93, 10.06)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ZONA_SUPERPUESTA"))
                .andExpect(jsonPath("$.mensaje").value(containsString("IT-Dentro-A")));
    }

    @Test
    @DisplayName("una zona que contiene a otra se rechaza con ZONA_SUPERPUESTA, y con confirmacion se guarda (CP-07)")
    void zonaQueContieneAOtraSeRechaza() throws Exception {
        crear(zona("IT-Contiene-A", -60.00, 10.00, -59.90, 10.10));
        String grande = zona("IT-Contiene-G", -60.05, 9.95, -59.85, 10.15);

        enviar(grande).andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("ZONA_SUPERPUESTA"));

        String respuesta = mvc.perform(post("/api/zonas?confirmarSuperposicion=true")
                        .contentType(MediaType.APPLICATION_JSON).content(grande))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        creadas.add(((Number) JsonPath.read(respuesta, "$.id")).longValue());
    }

    @Test
    @DisplayName("la tolerancia viene de application.yml (logistica.zonas.tolerancia-superposicion-m2 = 500)")
    void toleranciaConfigurada() {
        assertThat(toleranciaM2).isEqualTo(500d);
    }

    /** Cuerpo de una zona con vertices arbitrarios; cada vertice es {lng, lat} y el anillo se cierra solo. */
    private static String poligono(String nombre, double[]... vertices) {
        StringBuilder anillo = new StringBuilder();
        for (double[] v : vertices) {
            anillo.append("[%s,%s],".formatted(v[0], v[1]));
        }
        anillo.append("[%s,%s]".formatted(vertices[0][0], vertices[0][1]));
        return "{\"nombre\": \"%s\", \"area\": {\"type\": \"Polygon\", \"coordinates\": [[%s]]}}"
                .formatted(nombre, anillo);
    }

    /**
     * Zona A con un borde oblicuo de (-59.99, 10.00) a (-59.98, 10.01) (~1.6 km) y una zona B cuyos dos vertices
     * se "pegaron" sobre ese borde (t = 0.2 y 0.8), como hace el imán de la web, pero con una diferencia de
     * decimales de 0.000001 grados hacia adentro de A (~0.16 m): una franja de ~150 m2, bajo la tolerancia.
     */
    @Test
    @DisplayName("un borde pegado a puntos del borde del vecino, con diferencia de decimales, se acepta")
    void bordePegadoConDiferenciaDeDecimalesSeAcepta() throws Exception {
        crear(poligono("IT-Pegada-A", new double[]{-60.00, 10.00}, new double[]{-59.99, 10.00},
                new double[]{-59.98, 10.01}, new double[]{-60.00, 10.01}));

        crear(poligono("IT-Pegada-B", new double[]{-59.988001, 10.002001}, new double[]{-59.975, 10.002},
                new double[]{-59.975, 10.008}, new double[]{-59.982001, 10.008001}));
    }

    @Test
    @DisplayName("la misma forma con una invasion real de ~16 m (>> 500 m2) se rechaza")
    void invasionRealSeRechaza() throws Exception {
        crear(poligono("IT-Invasion-A", new double[]{-60.00, 10.00}, new double[]{-59.99, 10.00},
                new double[]{-59.98, 10.01}, new double[]{-60.00, 10.01}));

        enviar(poligono("IT-Invasion-B", new double[]{-59.988100, 10.002100}, new double[]{-59.975, 10.002},
                new double[]{-59.975, 10.008}, new double[]{-59.982100, 10.008100}))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("ZONA_SUPERPUESTA"));
    }

    @Test
    @DisplayName("una zona nueva que contiene a una diminuta (< 500 m2) ya existente se rechaza")
    void zonaQueContieneAUnaDiminutaSeRechaza() throws Exception {
        // ~11 m x 11 m = ~120 m2, mucho menos que la tolerancia
        crear(zona("IT-Mini", -60.0000, 10.0000, -59.9999, 10.0001));

        enviar(zona("IT-Mini-Grande", -60.01, 9.99, -59.99, 10.01)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ZONA_SUPERPUESTA"))
                .andExpect(jsonPath("$.mensaje").value(containsString("IT-Mini")));
    }
}
