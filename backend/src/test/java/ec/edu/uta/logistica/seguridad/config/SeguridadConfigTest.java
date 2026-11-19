package ec.edu.uta.logistica.seguridad.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import ec.edu.uta.logistica.seguridad.service.TokenService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/** Firma y validacion de los JWT (HS256) sin levantar Spring. */
class SeguridadConfigTest {

    private static final String SECRETO = "clave-de-pruebas-unitarias-de-32-bytes-o-mas";
    private final SeguridadConfig config = new SeguridadConfig();

    private static SeguridadProperties propiedades(String secreto, String emisor) {
        return new SeguridadProperties(true, new SeguridadProperties.Jwt(secreto, 60, emisor));
    }

    private String token(SeguridadProperties propiedades, Clock reloj, Usuario usuario) {
        return new TokenService(config.jwtEncoder(propiedades), propiedades, reloj).emitir(usuario).token();
    }

    @Test
    @DisplayName("un secreto ausente o de menos de 32 caracteres impide arrancar (HS256 exige 256 bits)")
    void secretoCorto() {
        var propiedades = propiedades("corto", "x");
        assertThatThrownBy(() -> SeguridadConfig.clave(propiedades))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("32");
        var propiedades2 = propiedades(null, "x");
        assertThatThrownBy(() -> SeguridadConfig.clave(propiedades2))
                .isInstanceOf(IllegalStateException.class);
        assertThat(SeguridadConfig.clave(propiedades(SECRETO, "x")).getAlgorithm()).isEqualTo("HmacSHA256");
    }

    @Test
    @DisplayName("el token emitido se valida y su rol se convierte en la autoridad ROLE_COURIER")
    void tokenValidoYAutoridad() {
        SeguridadProperties propiedades = propiedades(SECRETO, "logistica-test");
        String token = token(propiedades, Clock.systemUTC(), new Usuario("andrea", "x", Rol.COURIER, 3L));

        var autenticacion = config.jwtAuthenticationConverter().convert(config.jwtDecoder(propiedades).decode(token));

        assertThat(autenticacion.getName()).isEqualTo("andrea");
        assertThat(autenticacion.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .contains("ROLE_COURIER").doesNotContain("ROLE_STAFF");
    }

    @Test
    @DisplayName("se rechaza un token vencido, uno firmado con otra clave y uno de otro emisor")
    void tokensInvalidos() {
        SeguridadProperties buenas = propiedades(SECRETO, "logistica-test");
        JwtDecoder decodificador = config.jwtDecoder(buenas);
        Usuario staff = new Usuario("staff", "x", Rol.STAFF, null);

        Clock haceUnDia = Clock.fixed(Instant.now().minusSeconds(86_400), ZoneOffset.UTC);
        String vencido = token(buenas, haceUnDia, staff);
        String otraClave = token(propiedades("otra-clave-distinta-de-32-bytes-o-mas!!", "logistica-test"),
                Clock.systemUTC(), staff);
        String otroEmisor = token(propiedades(SECRETO, "otro-sistema"), Clock.systemUTC(), staff);

        assertThatThrownBy(() -> decodificador.decode(vencido)).isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> decodificador.decode(otraClave)).isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> decodificador.decode(otroEmisor)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("cada rol tiene su origen: STAFF -> WEB, COURIER -> MOVIL")
    void origenPorRol() {
        assertThat(Rol.STAFF.origen().name()).isEqualTo("WEB");
        assertThat(Rol.COURIER.origen().name()).isEqualTo("MOVIL");
        assertThat(Rol.STAFF.autoridad()).isEqualTo("ROLE_STAFF");
    }
}
