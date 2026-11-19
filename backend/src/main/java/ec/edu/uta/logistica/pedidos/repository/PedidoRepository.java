package ec.edu.uta.logistica.pedidos.repository;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
     * Listado con filtros opcionales (parametro nulo = sin filtrar), busqueda por texto en cliente y direccion (sin
     * mayusculas ni tildes) y orden por columna logica ({@link ConsultaPedidos#COLUMNAS_ORDENABLES}). Se arma con
     * Specification porque el patron JPQL "(:p is null or ...)" no funciona en PostgreSQL con parametros nulos sin
     * tipo. El orden del {@code Pageable} lo aplica la especificacion; sin orden, entrega (fecha y hora) y luego id.
     */
    default Page<Pedido> buscar(LocalDate fecha, Long zonaId, EstadoPedido estado, String texto, Pageable paginacion) {
        Specification<Pedido> filtros =
                ConsultaPedidos.especificacion(fecha, zonaId, estado, texto, paginacion.getSort());
        return findAll(filtros, PageRequest.of(paginacion.getPageNumber(), paginacion.getPageSize()));
    }

    /** Igual que {@link #buscar(LocalDate, Long, EstadoPedido, String, Pageable)} sin busqueda por texto. */
    default Page<Pedido> buscar(LocalDate fecha, Long zonaId, EstadoPedido estado, Pageable paginacion) {
        return buscar(fecha, zonaId, estado, null, paginacion);
    }

    /**
     * Todos los pedidos de las rutas de una fecha, con su cliente y su zona, en orden de visita dentro de cada ruta
     * (ruta, orden). Una sola consulta para armar el listado de rutas sin consultar ruta por ruta ni pedido por pedido.
     */
    @Query("""
            select p from Pedido p join fetch p.cliente join fetch p.zona
            where p.ruta.fecha = :fecha
            order by p.ruta.id, p.ordenEnRuta
            """)
    List<Pedido> buscarDeRutasPorFecha(@Param("fecha") LocalDate fecha);

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
