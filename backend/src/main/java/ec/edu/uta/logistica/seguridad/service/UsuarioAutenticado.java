package ec.edu.uta.logistica.seguridad.service;

import ec.edu.uta.logistica.seguridad.entity.Rol;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Quien hace la peticion, leido del token.
 *
 * @param repartidorId solo para COURIER
 */
public record UsuarioAutenticado(String usuario, Rol rol, Long repartidorId) {

    public static UsuarioAutenticado desde(Jwt jwt) {
        Object repartidor = jwt.getClaims().get(TokenService.CLAIM_REPARTIDOR);
        return new UsuarioAutenticado(jwt.getSubject(), Rol.valueOf(jwt.getClaimAsString(TokenService.CLAIM_ROL)),
                repartidor instanceof Number numero ? numero.longValue() : null);
    }

    public boolean esCourier() {
        return rol == Rol.COURIER;
    }
}
