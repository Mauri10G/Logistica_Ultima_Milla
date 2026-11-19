package ec.edu.uta.logistica.seguridad.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import ec.edu.uta.logistica.seguridad.config.SeguridadProperties;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Emite los JWT (HS256) con el usuario en {@code sub}, el rol y, para COURIER, el repartidorId. */
@Service
public class TokenService {

    public static final String CLAIM_ROL = "rol";
    public static final String CLAIM_REPARTIDOR = "repartidorId";

    private final JwtEncoder codificador;
    private final SeguridadProperties propiedades;
    private final Clock reloj;

    public TokenService(JwtEncoder codificador, SeguridadProperties propiedades, Clock reloj) {
        this.codificador = codificador;
        this.propiedades = propiedades;
        this.reloj = reloj;
    }

    /** Token firmado y el instante en que vence. */
    public record TokenEmitido(String token, Instant expiraEn) {
    }

    public TokenEmitido emitir(Usuario usuario) {
        Instant ahora = reloj.instant().truncatedTo(ChronoUnit.SECONDS); // el JWT guarda iat y exp en segundos
        Instant expira = ahora.plus(Duration.ofMinutes(propiedades.jwt().expiracionMinutos()));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(propiedades.jwt().emisor())
                .subject(usuario.getUsuario())
                .issuedAt(ahora)
                .expiresAt(expira)
                .claim(CLAIM_ROL, usuario.getRol().name());
        if (usuario.getRepartidorId() != null) {
            claims.claim(CLAIM_REPARTIDOR, usuario.getRepartidorId());
        }
        JwsHeader cabecera = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = codificador.encode(JwtEncoderParameters.from(cabecera, claims.build())).getTokenValue();
        return new TokenEmitido(token, expira);
    }
}
