package ec.edu.uta.logistica.zonas.controller;

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
}
