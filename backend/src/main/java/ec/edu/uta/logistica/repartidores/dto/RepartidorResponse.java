package ec.edu.uta.logistica.repartidores.dto;

import ec.edu.uta.logistica.repartidores.entity.Repartidor;

/** {@code usuario} es el nombre con que entra a la app movil (nunca la clave ni su hash); null si no tiene cuenta. */
public record RepartidorResponse(Long id, String nombres, String telefono, boolean disponible,
                                 int capacidadMaxima, boolean activo, String usuario) {

    public static RepartidorResponse desde(Repartidor r, String usuario) {
        return new RepartidorResponse(r.getId(), r.getNombres(), r.getTelefono(), r.isDisponible(),
                r.getCapacidadMaxima(), r.isActivo(), usuario);
    }
}
