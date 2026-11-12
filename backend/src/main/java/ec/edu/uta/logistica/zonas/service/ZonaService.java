package ec.edu.uta.logistica.zonas.service;

import java.util.List;
import java.util.stream.Collectors;

import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.common.geo.GeoJsonUtil;
import ec.edu.uta.logistica.zonas.dto.ZonaRequest;
import ec.edu.uta.logistica.zonas.dto.ZonaResponse;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.locationtech.jts.geom.Polygon;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ZonaService {

    private static final long SIN_EXCLUSION = 0L;

    /** Valor por defecto de {@code logistica.zonas.tolerancia-superposicion-m2}. */
    public static final double TOLERANCIA_POR_DEFECTO_M2 = 500d;

    private final ZonaRepository zonaRepository;
    private final double toleranciaSuperposicionM2;

    /**
     * @param toleranciaSuperposicionM2 {@code logistica.zonas.tolerancia-superposicion-m2}: area minima, en metros
     *                                  cuadrados, que debe tener la interseccion de dos zonas para contar como
     *                                  superposicion (absorbe las diferencias de decimales al pegar bordes)
     */
    public ZonaService(ZonaRepository zonaRepository,
                       @Value("${logistica.zonas.tolerancia-superposicion-m2:500}") double toleranciaSuperposicionM2) {
        this.zonaRepository = zonaRepository;
        this.toleranciaSuperposicionM2 = toleranciaSuperposicionM2;
    }

    @Transactional(readOnly = true)
    public List<ZonaResponse> listar(boolean soloActivas) {
        List<Zona> zonas = soloActivas ? zonaRepository.findByActivaTrueOrderByNombre()
                : zonaRepository.findAllByOrderByNombre();
        return zonas.stream().map(ZonaResponse::desde).toList();
    }

    @Transactional(readOnly = true)
    public ZonaResponse obtener(Long id) {
        return ZonaResponse.desde(buscar(id));
    }

    /**
     * @param confirmarSuperposicion param de consulta {@code confirmarSuperposicion}; tambien se acepta en el cuerpo
     */
    @Transactional
    public ZonaResponse crear(ZonaRequest solicitud, boolean confirmarSuperposicion) {
        if (zonaRepository.existsByNombreIgnoreCase(solicitud.nombre().trim())) {
            throw new ConflictoException("ZONA_DUPLICADA", "Ya existe una zona con el nombre " + solicitud.nombre());
        }
        Polygon area = GeoJsonUtil.aPoligono(solicitud.area());
        if (solicitud.estaActiva()) {
            verificarSuperposicion(area, SIN_EXCLUSION, confirmarSuperposicion || solicitud.confirmaSuperposicion());
        }
        Zona zona = zonaRepository.save(new Zona(solicitud.nombre().trim(), area, solicitud.estaActiva()));
        return ZonaResponse.desde(zona);
    }

    @Transactional
    public ZonaResponse actualizar(Long id, ZonaRequest solicitud, boolean confirmarSuperposicion) {
        Zona zona = buscar(id);
        String nombre = solicitud.nombre().trim();
        zonaRepository.findByNombreIgnoreCase(nombre).filter(otra -> !otra.getId().equals(id)).ifPresent(otra -> {
            throw new ConflictoException("ZONA_DUPLICADA", "Ya existe una zona con el nombre " + nombre);
        });
        Polygon area = GeoJsonUtil.aPoligono(solicitud.area());
        if (solicitud.estaActiva()) {
            verificarSuperposicion(area, id, confirmarSuperposicion || solicitud.confirmaSuperposicion());
        }
        zona.setNombre(nombre);
        zona.setArea(area);
        zona.setActiva(solicitud.estaActiva());
        return ZonaResponse.desde(zonaRepository.save(zona));
    }

    /** Baja logica: los pedidos historicos siguen referenciando la zona. */
    @Transactional
    public void desactivar(Long id) {
        Zona zona = buscar(id);
        zona.setActiva(false);
        zonaRepository.save(zona);
    }

    private void verificarSuperposicion(Polygon area, long excluirId, boolean confirmada) {
        if (confirmada) {
            return;
        }
        List<Zona> superpuestas = zonaRepository.buscarSuperpuestas(area.toText(), excluirId,
                toleranciaSuperposicionM2);
        if (!superpuestas.isEmpty()) {
            String nombres = superpuestas.stream().map(Zona::getNombre).collect(Collectors.joining(", "));
            throw new ConflictoException("ZONA_SUPERPUESTA", "El area se superpone con: " + nombres
                    + " (se cruza, la contiene o queda dentro de ella)."
                    + " Dos zonas pueden compartir borde, pero no ocupar la misma superficie.");
        }
    }

    private Zona buscar(Long id) {
        return zonaRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe la zona con id " + id));
    }
}
