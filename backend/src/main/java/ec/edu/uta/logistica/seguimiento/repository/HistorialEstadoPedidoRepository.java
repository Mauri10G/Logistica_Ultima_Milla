package ec.edu.uta.logistica.seguimiento.repository;

import java.util.List;

import ec.edu.uta.logistica.seguimiento.entity.HistorialEstadoPedido;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HistorialEstadoPedidoRepository extends JpaRepository<HistorialEstadoPedido, Long> {

    List<HistorialEstadoPedido> findByPedidoIdOrderByFechaCambioAscIdAsc(Long pedidoId);
}
