package ec.edu.uta.logistica.zonas.dto;

import java.util.Map;

import ec.edu.uta.logistica.common.geo.GeoJsonUtil;
import ec.edu.uta.logistica.zonas.entity.Zona;

public record ZonaResponse(Long id, String nombre, Map<String, Object> area, boolean activa) {

    public static ZonaResponse desde(Zona zona) {
        return new ZonaResponse(zona.getId(), zona.getNombre(), GeoJsonUtil.aGeoJson(zona.getArea()), zona.isActiva());
    }
}
