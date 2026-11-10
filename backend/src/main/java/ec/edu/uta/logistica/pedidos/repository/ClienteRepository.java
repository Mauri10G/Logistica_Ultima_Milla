package ec.edu.uta.logistica.pedidos.repository;

import ec.edu.uta.logistica.pedidos.entity.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
}
