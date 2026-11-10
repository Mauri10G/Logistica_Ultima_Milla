package ec.edu.uta.logistica.repartidores.repository;

import java.util.List;

import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RepartidorRepository extends JpaRepository<Repartidor, Long> {

    List<Repartidor> findByActivoTrueOrderByNombres();

    /** Repartidores que pueden recibir rutas. */
    List<Repartidor> findByActivoTrueAndDisponibleTrueOrderById();
}
