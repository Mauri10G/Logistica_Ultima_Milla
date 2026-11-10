package ec.edu.uta.logistica.zonas.dto;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * @param area                  poligono en GeoJSON ({@code {"type":"Polygon","coordinates":[[[lng,lat],...]]}})
 * @param confirmarSuperposicion si es true se permite guardar aunque el area se superponga con otra zona
 */
public record ZonaRequest(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100, message = "El nombre admite hasta 100 caracteres")
        String nombre,
        @NotNull(message = "El area es obligatoria")
        Map<String, Object> area,
        Boolean activa,
        Boolean confirmarSuperposicion) {

    public boolean confirmaSuperposicion() {
        return Boolean.TRUE.equals(confirmarSuperposicion);
    }

    public boolean estaActiva() {
        return activa == null || activa;
    }
}
