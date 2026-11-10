package ec.edu.uta.logistica.zonas.repository;

import java.util.List;
import java.util.Optional;

import ec.edu.uta.logistica.zonas.entity.Zona;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ZonaRepository extends JpaRepository<Zona, Long> {

    boolean existsByNombreIgnoreCase(String nombre);

    Optional<Zona> findByNombreIgnoreCase(String nombre);

    List<Zona> findByActivaTrueOrderByNombre();

    List<Zona> findAllByOrderByNombre();

    /** CP-03: zona que contiene el punto (ST_Contains). Vacio si la direccion esta fuera de toda zona activa. */
    @Query(value = """
            SELECT * FROM zona
            WHERE activa = TRUE
              AND ST_Contains(area, ST_SetSRID(ST_MakePoint(:longitud, :latitud), 4326))
            ORDER BY id
            LIMIT 1
            """, nativeQuery = true)
    Optional<Zona> buscarZonaQueContiene(@Param("latitud") double latitud, @Param("longitud") double longitud);

    /** CP-06 a CP-08: zonas activas que se intersectan (ST_Intersects) con el poligono WKT, excluyendo la propia. */
    @Query(value = """
            SELECT * FROM zona
            WHERE activa = TRUE
              AND id <> :excluirId
              AND ST_Intersects(area, ST_GeomFromText(:wkt, 4326))
            ORDER BY nombre
            """, nativeQuery = true)
    List<Zona> buscarSuperpuestas(@Param("wkt") String wkt, @Param("excluirId") long excluirId);
}
