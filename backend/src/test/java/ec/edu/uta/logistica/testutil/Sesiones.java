package ec.edu.uta.logistica.testutil;

import java.time.Instant;
import java.util.List;

import ec.edu.uta.logistica.seguridad.entity.Rol;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Simula en pruebas unitarias la sesion de un STAFF o de un COURIER (lo que deja el filtro JWT). */
public final class Sesiones {

    private Sesiones() {
    }

    public static Jwt jwt(String usuario, Rol rol, Long repartidorId) {
        Jwt.Builder jwt = Jwt.withTokenValue("token-de-prueba").header("alg", "HS256").subject(usuario)
                .claim("rol", rol.name()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600));
        if (repartidorId != null) {
            jwt.claim("repartidorId", repartidorId);
        }
        return jwt.build();
    }

    public static void comoStaff() {
        iniciar(jwt("staff", Rol.STAFF, null));
    }

    public static void comoCourier(long repartidorId) {
        iniciar(jwt("courier" + repartidorId, Rol.COURIER, repartidorId));
    }

    public static void cerrar() {
        SecurityContextHolder.clearContext();
    }

    private static void iniciar(Jwt jwt) {
        Rol rol = Rol.valueOf(jwt.getClaimAsString("rol"));
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority(rol.autoridad()))));
    }
}
