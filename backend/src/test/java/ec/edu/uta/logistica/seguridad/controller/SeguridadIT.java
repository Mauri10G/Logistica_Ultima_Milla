package ec.edu.uta.logistica.seguridad.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;

import com.jayway.jsonpath.JsonPath;
import ec.edu.uta.logistica.IntegracionConSeguridadBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Login real contra PostGIS y permisos por rol con la seguridad encendida. Usa fechas de entrega propias
 * (hoy + 60 ... + 69) para no tocar los pedidos de "manana" de los datos base.
 */
class SeguridadIT extends IntegracionConSeguridadBase {

    private static final String CENTRO = "\"latitud\": -1.2412, \"longitud\": -78.6197";

    @Autowired
    private Clock reloj;

    private ResultActions login(String cuerpo) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(cuerpo));
    }

    // ------------------------------------------------------------------ login

    @Test
    @DisplayName("login real: STAFF recibe token y repartidorId nulo; COURIER recibe su repartidorId")
    void loginReal() throws Exception {
        login("{\"usuario\": \"staff\", \"clave\": \"staff123\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.rol").value("STAFF"))
                .andExpect(jsonPath("$.repartidorId").value(nullValue()))
                .andExpect(jsonPath("$.expiraEn").isNotEmpty());
        login("{\"usuario\": \"Carlos\", \"clave\": \"repartidor123\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("COURIER"))
                .andExpect(jsonPath("$.repartidorId").isNumber());
    }

    @Test
    @DisplayName("login: clave incorrecta o usuario inexistente -> 401 con el mensaje de la web; campos vacios -> 400")
    void loginFallido() throws Exception {
        login("{\"usuario\": \"staff\", \"clave\": \"mala\"}").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIALES_INVALIDAS"))
                .andExpect(jsonPath("$.mensaje").value("Usuario o clave incorrectos"));
        login("{\"usuario\": \"nadie\", \"clave\": \"clave-incorrecta\"}").andExpect(status().isUnauthorized());
        login("{\"usuario\": \"\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errores.usuario").exists())
                .andExpect(jsonPath("$.errores.clave").exists());
    }

    @Test
    @DisplayName("el login funciona aunque el cliente mande un token viejo o invalido")
    void loginIgnoraTokenViejo() throws Exception {
        mvc.perform(post("/api/auth/login").header(HttpHeaders.AUTHORIZATION, "Bearer token.vencido.viejo")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"usuario\": \"staff\", \"clave\": \"staff123\"}"))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ 401 y endpoints publicos

    @Test
    @DisplayName("sin token o con un token invalido -> 401 NO_AUTENTICADO con WWW-Authenticate: Bearer")
    void sinToken() throws Exception {
        mvc.perform(get("/api/pedidos")).andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("Bearer")))
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
        mvc.perform(get("/api/pedidos").with(bearer("no.es.un.jwt"))).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    @DisplayName("health, hora del servidor y Swagger son publicos")
    void publicos() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/api/servidor/hora")).andExpect(status().isOk());
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes.bearer.scheme").value("bearer"));
    }

    // ------------------------------------------------------------------ 403 por rol

    @Test
    @DisplayName("COURIER: zonas, repartidores, borrar pedidos, armar rutas y seguimiento -> 403; STAFF si puede")
    void courierNoAdministra() throws Exception {
        String courier = token("luis", CLAVE_REPARTIDOR);
        String staff = tokenStaff();
        String zona = "{\"nombre\": \"IT-Seg\", \"area\": {\"type\": \"Polygon\", \"coordinates\": "
                + "[[[-50.1,5.0],[-50.0,5.0],[-50.0,5.1],[-50.1,5.1],[-50.1,5.0]]]}}";

        mvc.perform(post("/api/zonas").with(bearer(courier)).contentType(MediaType.APPLICATION_JSON).content(zona))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.codigo").value("ACCESO_DENEGADO"));
        mvc.perform(get("/api/zonas").with(bearer(courier))).andExpect(status().isForbidden());
        mvc.perform(get("/api/repartidores").with(bearer(courier))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/pedidos/999999").with(bearer(courier))).andExpect(status().isForbidden());
        mvc.perform(post("/api/rutas/armar").param("fecha", LocalDate.now(reloj).plusDays(69).toString())
                .with(bearer(courier))).andExpect(status().isForbidden());
        mvc.perform(get("/api/seguimiento/pedidos/1/historial").with(bearer(courier)))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/zonas").with(bearer(staff))).andExpect(status().isOk());
        mvc.perform(get("/api/repartidores").with(bearer(staff))).andExpect(status().isOk());
        mvc.perform(post("/api/rutas/armar").param("fecha", LocalDate.now(reloj).plusDays(69).toString())
                .with(bearer(staff))).andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ COURIER y rutas ajenas

    @Test
    @DisplayName("un COURIER que toca un pedido o una ruta ajena recibe 403; el dueno avanza y el origen sale del rol")
    void courierSoloLoSuyo() throws Exception {
        String staff = tokenStaff();
        LocalDate fecha = LocalDate.now(reloj).plusDays(60);

        // STAFF registra un pedido y lo inserta como ultimo momento: queda en una ruta de algun repartidor
        String pedido = mvc.perform(post("/api/pedidos").with(bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"clienteNombres": "Cliente Seg", "clienteTelefono": "0991112223",
                                 "direccion": "Bolivar y Mera", %s, "fechaEntrega": "%s", "horaEntrega": "10:00"}
                                """.formatted(CENTRO, fecha)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long pedidoId = ((Number) JsonPath.read(pedido, "$.id")).longValue();
        String ruta = mvc.perform(post("/api/rutas/ultimo-momento/" + pedidoId).with(bearer(staff)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long rutaId = ((Number) JsonPath.read(ruta, "$.id")).longValue();
        long dueno = ((Number) JsonPath.read(ruta, "$.repartidorId")).longValue();

        Map<Long, String> tokens = tokensPorRepartidor();
        String propio = tokens.get(dueno);
        String ajeno = tokens.entrySet().stream().filter(e -> e.getKey() != dueno).findFirst().orElseThrow()
                .getValue();

        // el ajeno: 403 en el PATCH de estado, en el pedido, en la ruta y en la ruta-actual del dueno
        patchEstado(pedidoId, "RECOGIDO", "MOVIL", ajeno).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("ACCESO_DENEGADO"));
        mvc.perform(get("/api/pedidos/" + pedidoId).with(bearer(ajeno))).andExpect(status().isForbidden());
        mvc.perform(get("/api/rutas/" + rutaId).with(bearer(ajeno))).andExpect(status().isForbidden());
        mvc.perform(get("/api/repartidores/" + dueno + "/ruta-actual").with(bearer(ajeno)))
                .andExpect(status().isForbidden());

        // el dueno: ve su ruta y su pedido, y avanza el estado (el cuerpo dice WEB pero el rol manda: MOVIL)
        mvc.perform(get("/api/repartidores/" + dueno + "/ruta-actual").with(bearer(propio)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(rutaId));
        mvc.perform(get("/api/rutas/" + rutaId).with(bearer(propio))).andExpect(status().isOk());
        mvc.perform(get("/api/pedidos/" + pedidoId).with(bearer(propio))).andExpect(status().isOk());
        patchEstado(pedidoId, "RECOGIDO", "WEB", propio).andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("RECOGIDO"));
        // STAFF tambien puede (el cuerpo dice MOVIL pero el rol manda: WEB)
        patchEstado(pedidoId, "EN_CAMINO", "MOVIL", staff).andExpect(status().isOk());

        mvc.perform(get("/api/seguimiento/pedidos/" + pedidoId + "/historial").with(bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[1].estadoNuevo").value("RECOGIDO"))
                .andExpect(jsonPath("$[1].origen").value("MOVIL"))
                .andExpect(jsonPath("$[2].estadoNuevo").value("EN_CAMINO"))
                .andExpect(jsonPath("$[2].origen").value("WEB"));
    }

    private ResultActions patchEstado(long id, String estado, String origen, String token) throws Exception {
        return mvc.perform(patch("/api/pedidos/" + id + "/estado").with(bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"estado\": \"%s\", \"origen\": \"%s\"}".formatted(estado, origen)));
    }

    // ------------------------------------------------------------------ cabeceras y CORS

    @Test
    @DisplayName("las respuestas llevan las cabeceras de seguridad (CSP estricta en la API, propia en Swagger)")
    void cabecerasDeSeguridad() throws Exception {
        mvc.perform(get("/api/zonas").with(bearer(tokenStaff()))).andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Permissions-Policy", containsString("geolocation=()")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
        mvc.perform(get("/v3/api-docs"))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'self'")));
    }

    @Test
    @DisplayName("CORS: el preflight de la web (localhost:5173) se responde sin token")
    void preflightCors() throws Exception {
        mvc.perform(options("/api/pedidos").header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"));
        mvc.perform(options("/api/pedidos").header(HttpHeaders.ORIGIN, "http://sitio-malicioso.com")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden());
    }
}
