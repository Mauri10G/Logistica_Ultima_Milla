package ec.edu.uta.logistica.repartidores.dto;

import ec.edu.uta.logistica.repartidores.entity.Repartidor;

public record RepartidorResponse(Long id, String nombres, String telefono, boolean disponible,
                                 int capacidadMaxima, boolean activo) {

    public static RepartidorResponse desde(Repartidor r) {
        return new RepartidorResponse(r.getId(), r.getNombres(), r.getTelefono(), r.isDisponible(),
                r.getCapacidadMaxima(), r.isActivo());
    }
}
