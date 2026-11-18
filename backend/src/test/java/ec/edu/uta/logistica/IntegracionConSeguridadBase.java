package ec.edu.uta.logistica;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Base de las *IT que necesitan la seguridad ENCENDIDA ({@code logistica.seguridad.habilitada=true}). Todas comparten
 * este mismo contexto (y su propio contenedor PostGIS), distinto del de {@link IntegrationTestBase}, que corre con la
 * seguridad apagada como el perfil dev. Los tokens se obtienen con un login real contra la base (usuarios de V4).
 */
@TestPropertySource(properties = "logistica.seguridad.habilitada=true")
public abstract class IntegracionConSeguridadBase extends IntegrationTestBase {

    public static final String CLAVE_REPARTIDOR = "repartidor123";
    public static final String[] COURIERS = {"carlos", "luis", "andrea", "diego", "paola", "marco"};

    @Autowired
    protected MockMvc mvc;

    /** Login real: POST /api/auth/login y devuelve el token. */
    protected String token(String usuario, String clave) throws Exception {
        String respuesta = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\": \"%s\", \"clave\": \"%s\"}".formatted(usuario, clave)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(respuesta, "$.token");
    }

    protected String tokenStaff() throws Exception {
        return token("staff", "staff123");
    }

    /** Token de cada repartidor de V2, indexado por su repartidorId. */
    protected Map<Long, String> tokensPorRepartidor() throws Exception {
        Map<Long, String> tokens = new HashMap<>();
        for (String usuario : COURIERS) {
            String respuesta = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"usuario\": \"%s\", \"clave\": \"%s\"}".formatted(usuario, CLAVE_REPARTIDOR)))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            tokens.put(((Number) JsonPath.read(respuesta, "$.repartidorId")).longValue(),
                    JsonPath.read(respuesta, "$.token"));
        }
        return tokens;
    }

    /** Agrega {@code Authorization: Bearer <token>} a la peticion de MockMvc. */
    protected static RequestPostProcessor bearer(String token) {
        return peticion -> {
            peticion.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            return peticion;
        };
    }
}
