package ec.edu.uta.logistica.rutas.repository;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.rutas.entity.EstadoRuta;
import ec.edu.uta.logistica.rutas.entity.Ruta;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RutaRepository extends JpaRepository<Ruta, Long> {

    /**
     * Bloquea (SELECT ... FOR UPDATE) las rutas de una zona y fecha. Ver {@code BloqueoZonaFecha}:
     * por si solo no cubre el caso "todavia no hay rutas", por eso se combina con un advisory lock.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Ruta r where r.fecha = :fecha and r.zona.id = :zonaId order by r.id")
    List<Ruta> bloquearPorZonaYFecha(@Param("zonaId") Long zonaId, @Param("fecha") LocalDate fecha);

    /**
     * Rutas de un dia con TODO lo que necesita {@code RutaResponse} en una sola consulta: zona, repartidor y cada
     * pedido con su cliente y su zona. Antes se cargaban por lotes y el listado de San Valentin (~1 275 rutas y 5 100
     * pedidos) hacia ~130 consultas (issue #31). Los pedidos salen en {@code ordenEnRuta} por el {@code @OrderBy} de
     * {@code Ruta.pedidos}; {@code distinct} evita repetir la ruta por cada pedido del join.
     */
    @Query("""
            select distinct r from Ruta r
            join fetch r.zona
            join fetch r.repartidor
            left join fetch r.pedidos p
            left join fetch p.cliente
            left join fetch p.zona
            where r.fecha = :fecha
            order by r.zona.id, r.id
            """)
    List<Ruta> buscarPorFecha(@Param("fecha") LocalDate fecha);

    @Query("""
            select r from Ruta r join fetch r.zona join fetch r.repartidor
            where r.repartidor.id = :repartidorId and r.fecha >= :desde and r.estado <> :excluido
            order by r.fecha, r.id
            """)
    List<Ruta> buscarVigentesDeRepartidor(@Param("repartidorId") Long repartidorId, @Param("desde") LocalDate desde,
                                          @Param("excluido") EstadoRuta excluido);

    @Query("""
            select new ec.edu.uta.logistica.rutas.repository.CargaRepartidor(r.repartidor.id, count(p))
            from Ruta r join r.pedidos p
            where r.fecha = :fecha
            group by r.repartidor.id
            """)
    List<CargaRepartidor> cargaPorRepartidor(@Param("fecha") LocalDate fecha);

    long countByFecha(LocalDate fecha);
}
