package ec.edu.uta.logistica.rutas.repository;

/** Pedidos que ya tiene asignados un repartidor en una fecha (usado para repartir la carga). */
public record CargaRepartidor(Long repartidorId, long pedidos) {
}
