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

    /**
     * CP-03: zona activa que contiene el punto. Se usa ST_Covers (y no ST_Contains) porque con zonas contiguas un
     * punto exactamente sobre el borde compartido no pertenece al interior de ninguna: ST_Contains lo rechazaria y
     * ese cliente quedaria en un hueco de area cero. Con ST_Covers el borde cuenta como parte de la zona; si cae en
     * el borde de dos zonas se elige la de menor id (determinista). Vacio si esta fuera de toda zona activa.
     */
    @Query(value = """
            SELECT * FROM zona
            WHERE activa = TRUE
              AND ST_Covers(area, ST_SetSRID(ST_MakePoint(:longitud, :latitud), 4326))
            ORDER BY id
            LIMIT 1
            """, nativeQuery = true)
    Optional<Zona> buscarZonaQueContiene(@Param("latitud") double latitud, @Param("longitud") double longitud);

    /**
     * CP-06 a CP-08: zonas activas cuyo INTERIOR se cruza con el del poligono WKT, excluyendo la propia.
     *
     * <p>{@code ST_Relate(a, b, 'T********')} es verdadero cuando la interseccion de los interiores no es vacia
     * (celda II de la matriz DE-9IM). Dos zonas que solo comparten borde o vertices tienen II vacio y se aceptan;
     * un cruce parcial, una zona contenida en otra o dos zonas iguales tienen II no vacio.
     *
     * <p>Ademas, para absorber las diferencias de decimales al pegar un borde al de la vecina (franjas de
     * centimetros a lo largo del borde), la superposicion solo cuenta si el area de la interseccion, en metros
     * cuadrados (cast a geography), supera {@code toleranciaM2}. Una zona totalmente contenida en otra (o que la
     * contiene) se rechaza siempre, sin importar su area. {@code ST_CollectionExtract(..., 3)} deja solo los
     * poligonos de la interseccion. {@code &&} (cajas envolventes) es un filtro previo que aprovecha el indice GIST.
     */
    @Query(value = """
            SELECT * FROM zona
            WHERE activa = TRUE
              AND id <> :excluirId
              AND area && ST_GeomFromText(:wkt, 4326)
              AND ST_Relate(area, ST_GeomFromText(:wkt, 4326), 'T********')
              AND (ST_Area(ST_CollectionExtract(ST_Intersection(area, ST_GeomFromText(:wkt, 4326)), 3)::geography)
                       > :toleranciaM2
                   OR ST_CoveredBy(area, ST_GeomFromText(:wkt, 4326))
                   OR ST_CoveredBy(ST_GeomFromText(:wkt, 4326), area))
            ORDER BY nombre
            """, nativeQuery = true)
    List<Zona> buscarSuperpuestas(@Param("wkt") String wkt, @Param("excluirId") long excluirId,
                                  @Param("toleranciaM2") double toleranciaM2);
}
