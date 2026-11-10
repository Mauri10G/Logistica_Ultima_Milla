package ec.edu.uta.logistica.pedidos.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;

import com.jayway.jsonpath.JsonPath;
import ec.edu.uta.logistica.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Flujos completos por HTTP contra PostGIS real: CP-03 a CP-08 y el ciclo de vida de un pedido.
 * Usa fechas de entrega propias (hoy + 30 ... + 39) para no tocar los pedidos de "manana" de los datos base.
 */
class ApiRestIT extends IntegrationTestBase {

    private static final String CENTRO = "\"latitud\": -1.2412, \"longitud\": -78.6197";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private Clock reloj;

    private LocalDate hoy() {
        return LocalDate.now(reloj);
    }

    private static String pedidoJson(LocalDate fecha, String coordenadas) {
        return """
                {"clienteNombres": "Cliente API", "clienteTelefono": "0991112223", "direccion": "Bolivar y Mera",
                 %s, "fechaEntrega": "%s", "horaEntrega": "10:30"}
                """.formatted(coordenadas, fecha);
    }

    private ResultActions postJson(String url, String cuerpo) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(cuerpo));
    }

    private long crearPedido(LocalDate fecha) throws Exception {
        String respuesta = postJson("/api/pedidos", pedidoJson(fecha, CENTRO)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    @Test
    @DisplayName("registra un pedido, calcula su zona con ST_Contains y diferencia registro de entrega")
    void registraPedido() throws Exception {
        LocalDate entrega = hoy().plusDays(30);

        postJson("/api/pedidos", pedidoJson(entrega, CENTRO))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.zonaNombre").value("Centro"))
                .andExpect(jsonPath("$.estado").value("PENDIENTE"))
                .andExpect(jsonPath("$.fechaEntrega").value(entrega.toString()))
                .andExpect(jsonPath("$.fechaRegistro").exists())
                .andExpect(jsonPath("$.latitud").value(-1.2412))
                .andExpect(jsonPath("$.rutaId").doesNotExist());
    }

    @Test
    @DisplayName("CP-03: direccion fuera de toda zona -> 422 con el mensaje del enunciado")
    void direccionFueraDeZona() throws Exception {
        postJson("/api/pedidos", pedidoJson(hoy().plusDays(30), "\"latitud\": -1.3000, \"longitud\": -78.5000"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("DIRECCION_FUERA_DE_ZONA"))
                .andExpect(jsonPath("$.mensaje").value("La dirección no corresponde a ninguna zona configurada"));
    }

    @Test
    @DisplayName("CP-04: fecha de entrega anterior a hoy -> 422")
    void fechaPasada() throws Exception {
        postJson("/api/pedidos", pedidoJson(hoy().minusDays(1), CENTRO))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("FECHA_ENTREGA_PASADA"));
    }

    @Test
    @DisplayName("Bean Validation: campos obligatorios faltantes -> 400 con el detalle por campo")
    void validacion() throws Exception {
        postJson("/api/pedidos", """
                {"clienteNombres": "X", "clienteTelefono": "1", "latitud": 95, "fechaEntrega": "%s"}
                """.formatted(hoy().plusDays(30)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("VALIDACION"))
                .andExpect(jsonPath("$.errores.direccion").exists())
                .andExpect(jsonPath("$.errores.latitud").exists())
                .andExpect(jsonPath("$.errores.longitud").exists())
                .andExpect(jsonPath("$.errores.horaEntrega").exists());
    }

    @Test
    @DisplayName("CP-05 y estados: pedido asignado no se edita; el PATCH valida la transicion y deja historial")
    void cicloDeVidaDelPedido() throws Exception {
        long id = crearPedido(hoy().plusDays(31));

        // pedido de ultimo momento: no hay rutas ese dia -> se crea una nueva y el pedido queda ASIGNADO
        String ruta = postJson("/api/rutas/ultimo-momento/" + id, "").andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ARMADA"))
                .andExpect(jsonPath("$.pedidos", hasSize(1)))
                .andReturn().getResponse().getContentAsString();
        long rutaId = ((Number) JsonPath.read(ruta, "$.id")).longValue();
        mvc.perform(get("/api/pedidos/" + id)).andExpect(jsonPath("$.estado").value("ASIGNADO"))
                .andExpect(jsonPath("$.rutaId").value(rutaId)).andExpect(jsonPath("$.ordenEnRuta").value(1));

        // CP-05: ya no es PENDIENTE
        mvc.perform(put("/api/pedidos/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(pedidoJson(hoy().plusDays(31), CENTRO)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("PEDIDO_NO_EDITABLE"));
        mvc.perform(delete("/api/pedidos/" + id)).andExpect(status().isConflict());

        // transicion invalida: ASIGNADO -> ENTREGADO
        patchEstado(id, "ENTREGADO", "MOVIL").andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("TRANSICION_INVALIDA"));
        // ASIGNADO no se fija a mano
        patchEstado(id, "ASIGNADO", "WEB").andExpect(status().isUnprocessableContent());

        // flujo valido desde el movil: la ruta pasa a EN_CURSO y, al entregar el unico pedido, a FINALIZADA
        patchEstado(id, "RECOGIDO", "MOVIL").andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("RECOGIDO"));
        mvc.perform(get("/api/rutas/" + rutaId)).andExpect(jsonPath("$.estado").value("EN_CURSO"));
        patchEstado(id, "EN_CAMINO", "MOVIL").andExpect(status().isOk());
        patchEstado(id, "ENTREGADO", "MOVIL").andExpect(status().isOk());
        mvc.perform(get("/api/rutas/" + rutaId)).andExpect(jsonPath("$.estado").value("FINALIZADA"));

        mvc.perform(get("/api/seguimiento/pedidos/" + id + "/historial")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].estadoAnterior").value("PENDIENTE"))
                .andExpect(jsonPath("$[0].estadoNuevo").value("ASIGNADO"))
                .andExpect(jsonPath("$[1].estadoNuevo").value("RECOGIDO"))
                .andExpect(jsonPath("$[1].origen").value("MOVIL"))
                .andExpect(jsonPath("$[3].estadoNuevo").value("ENTREGADO"));
    }

    @Test
    @DisplayName("un pedido PENDIENTE se edita (CP-05) y recalcula su zona")
    void editaPendiente() throws Exception {
        long id = crearPedido(hoy().plusDays(32));

        mvc.perform(put("/api/pedidos/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(pedidoJson(hoy().plusDays(33), "\"latitud\": -1.2100, \"longitud\": -78.6050")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.zonaNombre").value("Norte/Izamba"))
                .andExpect(jsonPath("$.fechaEntrega").value(hoy().plusDays(33).toString()));
        mvc.perform(delete("/api/pedidos/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/pedidos/" + id)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/pedidos filtra por fecha y estado y devuelve el total en X-Total-Count")
    void listaConFiltros() throws Exception {
        LocalDate manana = hoy().plusDays(1);

        mvc.perform(get("/api/pedidos").param("fecha", manana.toString()).param("estado", "PENDIENTE")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "20"))
                .andExpect(jsonPath("$", hasSize(5)));
        mvc.perform(get("/api/pedidos").param("estado", "NO_EXISTE")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/rutas/armar arma rutas de 4 como maximo y GET /api/rutas las lista")
    void armaRutasPorHttp() throws Exception {
        LocalDate fecha = hoy().plusDays(34);
        for (int i = 0; i < 5; i++) {
            crearPedido(fecha);
        }

        mvc.perform(post("/api/rutas/armar").param("fecha", fecha.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].pedidos.length()").value(lessThanOrEqualTo(4)))
                .andExpect(jsonPath("$[1].pedidos.length()").value(lessThanOrEqualTo(4)))
                .andExpect(jsonPath("$[0].pedidos[0].ordenEnRuta").value(1));
        mvc.perform(get("/api/rutas").param("fecha", fecha.toString())).andExpect(jsonPath("$", hasSize(2)));
        // segunda llamada: ya no queda nada pendiente
        mvc.perform(post("/api/rutas/armar").param("fecha", fecha.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(post("/api/rutas/armar")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("CP-06 a CP-08: zonas superpuestas se rechazan salvo confirmarSuperposicion=true")
    void superposicionDeZonas() throws Exception {
        String base = "{\"nombre\": \"%s\", \"area\": {\"type\": \"Polygon\", \"coordinates\": [[[%s]]]}}";
        String zonaA = base.formatted("IT-A", "-70.10,0.00],[-70.00,0.00],[-70.00,0.10],[-70.10,0.10],[-70.10,0.00");
        String zonaB = base.formatted("IT-B", "-70.05,0.05],[-69.95,0.05],[-69.95,0.15],[-70.05,0.15],[-70.05,0.05");

        String respuestaA = postJson("/api/zonas", zonaA).andExpect(status().isCreated())
                .andExpect(jsonPath("$.area.type").value("Polygon")).andReturn().getResponse().getContentAsString();
        long idA = ((Number) JsonPath.read(respuestaA, "$.id")).longValue();

        // CP-06: se superpone con IT-A
        postJson("/api/zonas", zonaB).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ZONA_SUPERPUESTA"))
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("IT-A")));
        // CP-07: con la confirmacion se guarda
        String respuestaB = postJson("/api/zonas?confirmarSuperposicion=true", zonaB).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long idB = ((Number) JsonPath.read(respuestaB, "$.id")).longValue();
        // CP-08: editar IT-A sin cambiar su area ahora choca con IT-B, salvo confirmacion
        mvc.perform(put("/api/zonas/" + idA).contentType(MediaType.APPLICATION_JSON).content(zonaA))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/zonas/" + idA + "?confirmarSuperposicion=true").contentType(MediaType.APPLICATION_JSON)
                .content(zonaA)).andExpect(status().isOk());
        // nombre repetido
        postJson("/api/zonas?confirmarSuperposicion=true", zonaA).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ZONA_DUPLICADA"));
        // GeoJSON que no es un Polygon
        postJson("/api/zonas", "{\"nombre\": \"IT-C\", \"area\": {\"type\": \"Point\", \"coordinates\": [0, 0]}}")
                .andExpect(status().isBadRequest());

        // baja logica para no afectar a otras pruebas
        mvc.perform(delete("/api/zonas/" + idA)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/zonas/" + idB)).andExpect(status().isNoContent());
        mvc.perform(get("/api/zonas/" + idA)).andExpect(jsonPath("$.activa").value(false));
    }

    @Test
    @DisplayName("repartidores: alta, cambio de disponibilidad y ruta-actual sin ruta -> 404")
    void repartidores() throws Exception {
        String creado = postJson("/api/repartidores", """
                {"nombres": "Repartidor IT", "telefono": "0993334445"}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.capacidadMaxima").value(4))
                .andExpect(jsonPath("$.disponible").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(creado, "$.id")).longValue();

        mvc.perform(patch("/api/repartidores/" + id + "/disponibilidad").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"disponible\": false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.disponible").value(false));
        mvc.perform(get("/api/repartidores/" + id + "/ruta-actual")).andExpect(status().isNotFound());
        mvc.perform(get("/api/repartidores/999999/ruta-actual")).andExpect(status().isNotFound());
        mvc.perform(get("/api/repartidores")).andExpect(status().isOk());
        mvc.perform(delete("/api/repartidores/" + id)).andExpect(status().isNoContent());
    }

    private ResultActions patchEstado(long id, String estado, String origen) throws Exception {
        return mvc.perform(patch("/api/pedidos/" + id + "/estado").contentType(MediaType.APPLICATION_JSON)
                .content("{\"estado\": \"%s\", \"origen\": \"%s\"}".formatted(estado, origen)));
    }
}
