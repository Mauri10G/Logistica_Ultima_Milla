package ec.edu.uta.logistica.seguridad.service;

import java.util.Optional;
import java.util.UUID;

import ec.edu.uta.logistica.common.exception.NoAutenticadoException;
import ec.edu.uta.logistica.seguridad.dto.LoginRequest;
import ec.edu.uta.logistica.seguridad.dto.LoginResponse;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import ec.edu.uta.logistica.seguridad.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** {@code POST /api/auth/login}: valida usuario y clave (BCrypt) y emite el token. */
@Service
public class AuthService {

    public static final String CODIGO_CREDENCIALES_INVALIDAS = "CREDENCIALES_INVALIDAS";
    public static final String MENSAJE_CREDENCIALES_INVALIDAS = "Usuario o clave incorrectos";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder cifrador;
    private final TokenService tokenService;
    /**
     * Hash que se compara cuando el usuario no existe: asi la respuesta tarda lo mismo que con un usuario real y no
     * se puede averiguar que usuarios existen midiendo el tiempo.
     */
    private final String hashFicticio;

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder cifrador, TokenService tokenService) {
        this.usuarioRepository = usuarioRepository;
        this.cifrador = cifrador;
        this.tokenService = tokenService;
        this.hashFicticio = cifrador.encode(UUID.randomUUID().toString());
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest solicitud) {
        Optional<Usuario> encontrado = usuarioRepository.buscarPorUsuario(solicitud.usuario().trim());
        String hash = encontrado.map(Usuario::getClave).orElse(hashFicticio);
        boolean claveCorrecta = cifrador.matches(solicitud.clave(), hash);

        Usuario usuario = encontrado.filter(u -> claveCorrecta && u.isActivo())
                .orElseThrow(() -> new NoAutenticadoException(CODIGO_CREDENCIALES_INVALIDAS,
                        MENSAJE_CREDENCIALES_INVALIDAS));
        TokenService.TokenEmitido emitido = tokenService.emitir(usuario);
        return new LoginResponse(emitido.token(), usuario.getRol(), usuario.getRepartidorId(), emitido.expiraEn());
    }
}
