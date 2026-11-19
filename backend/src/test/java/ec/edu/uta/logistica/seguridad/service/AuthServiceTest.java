package ec.edu.uta.logistica.seguridad.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.ApiException;
import ec.edu.uta.logistica.common.exception.NoAutenticadoException;
import ec.edu.uta.logistica.seguridad.config.SeguridadConfig;
import ec.edu.uta.logistica.seguridad.config.SeguridadProperties;
import ec.edu.uta.logistica.seguridad.dto.LoginRequest;
import ec.edu.uta.logistica.seguridad.dto.LoginResponse;
import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import ec.edu.uta.logistica.seguridad.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

/** Login: BCrypt real (costo 4 para que sea rapido) y JWT real, solo el repositorio es un mock. */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    static final SeguridadProperties PROPIEDADES = new SeguridadProperties(true,
            new SeguridadProperties.Jwt("clave-de-pruebas-unitarias-de-32-bytes-o-mas", 60, "logistica-test"));

    @Mock
    private UsuarioRepository usuarioRepository;

    private final PasswordEncoder cifrador = new BCryptPasswordEncoder(4);
    private final SeguridadConfig config = new SeguridadConfig();
    private final JwtDecoder decodificador = config.jwtDecoder(PROPIEDADES);
    private AuthService servicio;

    @BeforeEach
    void preparar() {
        TokenService tokens = new TokenService(config.jwtEncoder(PROPIEDADES), PROPIEDADES, Clock.systemUTC());
        servicio = new AuthService(usuarioRepository, cifrador, tokens);
    }

    private Usuario usuario(String nombre, String clave, Rol rol, Long repartidorId) {
        return new Usuario(nombre, cifrador.encode(clave), rol, repartidorId);
    }

    @Test
    @DisplayName("STAFF con clave correcta recibe un token firmado, su rol y repartidorId nulo")
    void loginStaff() {
        when(usuarioRepository.buscarPorUsuario("staff"))
                .thenReturn(Optional.of(usuario("staff", "staff123", Rol.STAFF, null)));

        LoginResponse respuesta = servicio.login(new LoginRequest("staff", "staff123"));

        assertThat(respuesta.rol()).isEqualTo(Rol.STAFF);
        assertThat(respuesta.repartidorId()).isNull();
        Jwt jwt = decodificador.decode(respuesta.token());
        assertThat(jwt.getSubject()).isEqualTo("staff");
        assertThat(jwt.getClaimAsString("rol")).isEqualTo("STAFF");
        assertThat(jwt.hasClaim("repartidorId")).isFalse();
        assertThat(respuesta.expiraEn()).isEqualTo(jwt.getExpiresAt());
    }

    @Test
    @DisplayName("COURIER recibe su repartidorId en la respuesta y en el token; se ignoran espacios del usuario")
    void loginCourier() {
        when(usuarioRepository.buscarPorUsuario("carlos"))
                .thenReturn(Optional.of(usuario("carlos", "repartidor123", Rol.COURIER, 1L)));

        LoginResponse respuesta = servicio.login(new LoginRequest("  carlos ", "repartidor123"));

        assertThat(respuesta.rol()).isEqualTo(Rol.COURIER);
        assertThat(respuesta.repartidorId()).isEqualTo(1L);
        UsuarioAutenticado leido = UsuarioAutenticado.desde(decodificador.decode(respuesta.token()));
        assertThat(leido).isEqualTo(new UsuarioAutenticado("carlos", Rol.COURIER, 1L));
    }

    @Test
    @DisplayName("clave incorrecta: 401 CREDENCIALES_INVALIDAS con el mensaje que muestra la web")
    void claveIncorrecta() {
        when(usuarioRepository.buscarPorUsuario("staff"))
                .thenReturn(Optional.of(usuario("staff", "staff123", Rol.STAFF, null)));

        var credenciales = new LoginRequest("staff", "otra");
        assertThatThrownBy(() -> servicio.login(credenciales))
                .isInstanceOf(NoAutenticadoException.class)
                .hasMessage("Usuario o clave incorrectos")
                .satisfies(e -> {
                    assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(((ApiException) e).getCodigo()).isEqualTo("CREDENCIALES_INVALIDAS");
                });
    }

    @Test
    @DisplayName("usuario inexistente: el mismo 401 (no revela si el usuario existe)")
    void usuarioInexistente() {
        when(usuarioRepository.buscarPorUsuario(anyString())).thenReturn(Optional.empty());

        var credenciales = new LoginRequest("nadie", "staff123");
        assertThatThrownBy(() -> servicio.login(credenciales))
                .isInstanceOf(NoAutenticadoException.class)
                .hasMessage("Usuario o clave incorrectos");
    }

    @Test
    @DisplayName("usuario desactivado: 401 aunque la clave sea correcta")
    void usuarioInactivo() {
        Usuario inactivo = usuario("luis", "repartidor123", Rol.COURIER, 2L);
        inactivo.setActivo(false);
        when(usuarioRepository.buscarPorUsuario("luis")).thenReturn(Optional.of(inactivo));

        var credenciales = new LoginRequest("luis", "repartidor123");
        assertThatThrownBy(() -> servicio.login(credenciales))
                .isInstanceOf(NoAutenticadoException.class);
    }

    @Test
    @DisplayName("LoginRequest no muestra la clave en toString (no se filtra a los logs)")
    void noFiltraLaClave() {
        assertThat(new LoginRequest("staff", "staff123").toString()).doesNotContain("staff123").contains("***");
    }
}
