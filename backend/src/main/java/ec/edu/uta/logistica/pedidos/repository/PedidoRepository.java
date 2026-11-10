package ec.edu.uta.logistica.pedidos.repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PedidoRepository extends JpaRepository<Pedido, Long>, JpaSpecificationExecutor<Pedido> {

    @Override
    @EntityGraph(attributePaths = {"cliente", "zona", "ruta"})
    Page<Pedido> findAll(Specification<Pedido> filtros, Pageable paginacion);

    /**
     * Listado con filtros opcionales (parametro nulo = sin filtrar). Se arma con Specification porque el patron
     * JPQL "(:p is null or ...)" no funciona en PostgreSQL con parametros nulos sin tipo.
     */
    default Page<Pedido> buscar(LocalDate fecha, Long zonaId, EstadoPedido estado, Pageable paginacion) {
        Specification<Pedido> filtros = (pedido, consulta, cb) -> {
            List<Predicate> condiciones = new ArrayList<>();
            if (fecha != null) {
                condiciones.add(cb.equal(pedido.get("fechaEntrega"), fecha));
            }
            if (zonaId != null) {
                condiciones.add(cb.equal(pedido.get("zona").get("id"), zonaId));
            }
            if (estado != null) {
                condiciones.add(cb.equal(pedido.get("estado"), estado));
            }
            return cb.and(condiciones.toArray(Predicate[]::new));
        };
        Pageable ordenada = PageRequest.of(paginacion.getPageNumber(), paginacion.getPageSize(),
                Sort.by("fechaEntrega", "horaEntrega", "id"));
        return findAll(filtros, ordenada);
    }

    /** Zonas que tienen pedidos pendientes sin ruta para una fecha (solo ids: no carga entidades). */
    @Query("""
            select distinct p.zona.id from Pedido p
            where p.fechaEntrega = :fecha and p.estado = :estado and p.ruta is null
            order by p.zona.id
            """)
    List<Long> zonaIdsConPendientes(@Param("fecha") LocalDate fecha, @Param("estado") EstadoPedido estado);

    /** Pedidos listos para armar rutas. Debe llamarse DESPUES de tomar los bloqueos de zona. */
    @EntityGraph(attributePaths = {"zona", "cliente"})
    @Query("""
            select p from Pedido p
            where p.fechaEntrega = :fecha and p.estado = :estado and p.ruta is null
            order by p.zona.id, p.id
            """)
    List<Pedido> buscarSinRuta(@Param("fecha") LocalDate fecha, @Param("estado") EstadoPedido estado);

    long countByFechaEntrega(LocalDate fechaEntrega);
}
