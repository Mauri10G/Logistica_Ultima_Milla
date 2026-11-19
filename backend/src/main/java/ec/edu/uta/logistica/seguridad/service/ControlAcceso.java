package ec.edu.uta.logistica.seguridad.service;

import java.util.Objects;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.AccesoDenegadoException;
import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Reglas de acceso que dependen del dato y no solo de la URL: un COURIER solo toca lo de sus propias rutas.
 * Las reglas por rol (por ejemplo "zonas solo STAFF") estan en {@code SeguridadConfig}.
 *
 * <p>Sin sesion (con {@code logistica.seguridad.habilitada=false}) no se restringe nada.
 */
@Component
public class ControlAcceso {

    /** Usuario de la peticion actual; vacio si no hay token (seguridad deshabilitada). */
    public Optional<UsuarioAutenticado> usuarioActual() {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion instanceof JwtAuthenticationToken token) {
            return Optional.of(UsuarioAutenticado.desde(token.getToken()));
        }
        return Optional.empty();
    }

    /**
     * Origen de un cambio de estado: con sesion sale del rol (STAFF = WEB, COURIER = MOVIL) y se ignora lo que diga
     * el cuerpo; sin sesion se respeta el cuerpo (WEB si no viene) para no romper a los clientes sin login.
     */
    public OrigenCambio origen(OrigenCambio delCuerpo) {
        return usuarioActual().map(u -> u.rol().origen())
                .orElse(delCuerpo != null ? delCuerpo : OrigenCambio.WEB);
    }

    /** Un COURIER solo puede consultar lo de su propio repartidorId. */
    public void exigirRepartidorPropio(Long repartidorId) {
        courierActual().ifPresent(courier -> {
            if (!Objects.equals(courier.repartidorId(), repartidorId)) {
                throw new AccesoDenegadoException("Un repartidor solo puede consultar sus propias rutas");
            }
        });
    }

    /** Un COURIER solo puede tocar pedidos que esten en una ruta suya. */
    public void exigirPedidoPropio(Pedido pedido) {
        courierActual().ifPresent(courier -> {
            Long dueno = pedido.getRuta() != null ? pedido.getRuta().getRepartidor().getId() : null;
            if (dueno == null || !dueno.equals(courier.repartidorId())) {
                throw new AccesoDenegadoException("El pedido " + pedido.getId() + " no pertenece a una ruta suya");
            }
        });
    }

    private Optional<UsuarioAutenticado> courierActual() {
        return usuarioActual().filter(UsuarioAutenticado::esCourier);
    }
}
