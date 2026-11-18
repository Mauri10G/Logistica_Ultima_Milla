package ec.edu.uta.logistica.seguridad.entity;

import ec.edu.uta.logistica.pedidos.entity.OrigenCambio;

/**
 * Roles del sistema. Cada rol determina desde donde se hacen sus cambios de estado.
 * <ul>
 *   <li>{@code STAFF}: personal del negocio, usa la web ({@link OrigenCambio#WEB}).</li>
 *   <li>{@code COURIER}: repartidor, usa la app movil ({@link OrigenCambio#MOVIL}).</li>
 * </ul>
 */
public enum Rol {
    STAFF(OrigenCambio.WEB),
    COURIER(OrigenCambio.MOVIL);

    private final OrigenCambio origen;

    Rol(OrigenCambio origen) {
        this.origen = origen;
    }

    public OrigenCambio origen() {
        return origen;
    }

    /** Nombre de la autoridad de Spring Security, por ejemplo {@code ROLE_STAFF}. */
    public String autoridad() {
        return "ROLE_" + name();
    }
}
