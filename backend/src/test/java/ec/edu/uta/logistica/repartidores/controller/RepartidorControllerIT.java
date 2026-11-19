package ec.edu.uta.logistica.repartidores.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import ec.edu.uta.logistica.IntegracionConSeguridadBase;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import ec.edu.uta.logistica.seguridad.repository.UsuarioRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Alta de repartidores con su usuario (seguridad encendida, PostGIS real): el repartidor creado desde la web puede
 * iniciar sesion de inmediato en la app movil. Cada prueba usa un usuario propio para no chocar con las demas.
 */
class RepartidorControllerIT extends IntegracionConSeguridadBase {

    @Autowired
    private RepartidorRepository repartidorRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;

    private static String usuarioUnico() {
        return "it" + Long.toString(System.nanoTime(), 36);
    }

    private static String cuerpo(String usuario, String clave) {
        String credenciales = (usuario == null ? "" : ", \"usuario\": \"" + usuario + "\"")
                + (clave == null ? "" : ", \"clave\": \"" + clave + "\"");
        return "{\"nombres\": \"Repartidor de prueba\", \"telefono\": \"0990000000\"" + credenciales + "}";
    }

    private ResultActions alta(String token, String cuerpo) throws Exception {
        return mvc.perform(post("/api/repartidores").with(bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo));
    }

    @Test
    @DisplayName("alta: 201 con el usuario (sin clave ni hash) y con ese usuario el login devuelve token COURIER del nuevo repartidor")
    void altaYLoginDelNuevoRepartidor() throws Exception {
        String usuario = usuarioUnico();
        String respuesta = alta(tokenStaff(), cuerpo(usuario, "secreto1")).andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/repartidores/")))
                .andExpect(jsonPath("$.usuario").value(usuario))
                .andExpect(jsonPath("$.clave").doesNotExist())
                .andExpect(jsonPath("$.nombres").value("Repartidor de prueba"))
                .andExpect(content -> assertThat(content.getResponse().getContentAsString())
                        .doesNotContain("secreto1").doesNotContain("$2a$"))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(respuesta, "$.id")).longValue();

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\": \"%s\", \"clave\": \"secreto1\"}".formatted(usuario.toUpperCase())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.rol").value("COURIER"))
                .andExpect(jsonPath("$.repartidorId").value(id));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\": \"%s\", \"clave\": \"otra-clave\"}".formatted(usuario)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("el repartidor nuevo usa su token en la app: consulta su ruta (404 sin ruta, no 403) y la de otro es 403")
    void elNuevoRepartidorOperaConSuToken() throws Exception {
        String usuario = usuarioUnico();
        String respuesta = alta(tokenStaff(), cuerpo(usuario, "secreto1")).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(respuesta, "$.id")).longValue();
        String token = token(usuario, "secreto1");

        mvc.perform(get("/api/repartidores/" + id + "/ruta-actual").with(bearer(token)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/repartidores/1/ruta-actual").with(bearer(token))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("usuario repetido (aunque cambien las mayusculas en la base): 409 USUARIO_DUPLICADO y no queda un repartidor sin usuario")
    void usuarioRepetido() throws Exception {
        String existente = "Mixto." + usuarioUnico();
        usuarioRepository.save(new Usuario(existente, "hash-que-no-se-usa", Rol.STAFF, null));
        long antes = repartidorRepository.count();
        String staff = tokenStaff();

        alta(staff, cuerpo(existente.toLowerCase(), "secreto1")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.codigo").value("USUARIO_DUPLICADO"))
                .andExpect(jsonPath("$.mensaje").value(containsString("ya existe")));
        alta(staff, cuerpo("carlos", "secreto1")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("USUARIO_DUPLICADO"));

        assertThat(repartidorRepository.count()).isEqualTo(antes);
    }

    @Test
    @DisplayName("el segundo alta con el mismo usuario recien creado tambien da 409")
    void segundaAltaConElMismoUsuario() throws Exception {
        String usuario = usuarioUnico();
        String staff = tokenStaff();
        alta(staff, cuerpo(usuario, "secreto1")).andExpect(status().isCreated());
        long antes = repartidorRepository.count();

        alta(staff, cuerpo(usuario, "secreto2")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("USUARIO_DUPLICADO"));

        assertThat(repartidorRepository.count()).isEqualTo(antes);
    }

    @Test
    @DisplayName("validaciones: usuario y clave obligatorios, usuario de 3 a 50 con a-z 0-9 . _ y clave de 6 o mas -> 400")
    void validaciones() throws Exception {
        String staff = tokenStaff();
        long antes = repartidorRepository.count();

        alta(staff, cuerpo(null, "secreto1")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("VALIDACION")).andExpect(jsonPath("$.errores.usuario").exists());
        alta(staff, cuerpo(usuarioUnico(), null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errores.clave").exists());
        for (String invalido : new String[]{"", "ab", "Ana.Ruiz", "ana ruiz", "ana-ruiz", "ana@ruiz", "aná.ruiz",
                "a".repeat(51)}) {
            alta(staff, cuerpo(invalido, "secreto1")).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errores.usuario").exists());
        }
        for (String invalida : new String[]{"", "abc12", "x".repeat(73)}) {
            alta(staff, cuerpo(usuarioUnico(), invalida)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errores.clave").exists())
                    .andExpect(content -> assertThat(content.getResponse().getContentAsString())
                            .doesNotContain("secreto1"));
        }
        // 37 letras de 2 bytes: pasa el largo en caracteres (37 <= 72) pero supera los 72 bytes que admite BCrypt
        alta(staff, cuerpo(usuarioUnico(), "ñ".repeat(37))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("SOLICITUD_INVALIDA"));

        assertThat(repartidorRepository.count()).isEqualTo(antes);
    }

    @Test
    @DisplayName("en los bordes se acepta: usuario de 3 y de 50 caracteres, y clave de exactamente 6")
    void bordesValidos() throws Exception {
        String staff = tokenStaff();
        String largo = ("l" + Long.toString(System.nanoTime(), 36) + "0".repeat(50)).substring(0, 50);

        String corto = Long.toString(System.nanoTime(), 36);
        corto = corto.substring(corto.length() - 3);

        alta(staff, cuerpo(largo, "123456")).andExpect(status().isCreated());
        alta(staff, cuerpo(corto, "123456")).andExpect(status().isCreated());
        token(largo, "123456");
        token(corto, "123456");
    }

    @Test
    @DisplayName("editar (PUT) no pide usuario ni clave, y la respuesta sigue mostrando el usuario")
    void editarSinCredenciales() throws Exception {
        String usuario = usuarioUnico();
        String respuesta = alta(tokenStaff(), cuerpo(usuario, "secreto1")).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(respuesta, "$.id")).longValue();

        mvc.perform(put("/api/repartidores/" + id).with(bearer(tokenStaff())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombres\": \"Nombre editado\", \"telefono\": \"0991111111\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombres").value("Nombre editado"))
                .andExpect(jsonPath("$.usuario").value(usuario));
        token(usuario, "secreto1"); // editar no toca la clave
    }

    @Test
    @DisplayName("el listado trae el usuario de cada repartidor y nunca clave ni hash")
    void listadoConUsuarios() throws Exception {
        mvc.perform(get("/api/repartidores").with(bearer(tokenStaff())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == 1)].usuario").value("carlos"))
                .andExpect(jsonPath("$[*].clave").isEmpty())
                .andExpect(content -> assertThat(content.getResponse().getContentAsString()).doesNotContain("$2a$"));
    }

    @Test
    @DisplayName("un COURIER no puede dar de alta repartidores (403) y sin token es 401")
    void soloElPersonalDaDeAlta() throws Exception {
        String courier = token("carlos", CLAVE_REPARTIDOR);
        alta(courier, cuerpo(usuarioUnico(), "secreto1")).andExpect(status().isForbidden());
        mvc.perform(post("/api/repartidores").contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(usuarioUnico(), "secreto1")))
                .andExpect(status().isUnauthorized());
    }
}
