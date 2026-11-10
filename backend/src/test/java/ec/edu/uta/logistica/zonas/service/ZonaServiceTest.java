package ec.edu.uta.logistica.zonas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.ApiException;
import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.dto.ZonaRequest;
import ec.edu.uta.logistica.zonas.dto.ZonaResponse;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** CP-06 a CP-08: superposicion de zonas. */
@ExtendWith(MockitoExtension.class)
class ZonaServiceTest {

    @Mock
    private ZonaRepository zonaRepository;

    private ZonaService servicio;
    private final Zona centro = Fabrica.zona(1L, "Centro");

    @BeforeEach
    void preparar() {
        servicio = new ZonaService(zonaRepository);
    }

    private static Map<String, Object> geoJson() {
        return Map.of("type", "Polygon", "coordinates", List.of(List.of(
                List.of(-78.62, -1.24), List.of(-78.61, -1.24), List.of(-78.61, -1.23),
                List.of(-78.62, -1.23), List.of(-78.62, -1.24))));
    }

    @Test
    @DisplayName("CP-06: una zona que se superpone con otra se rechaza (409) y se nombra la zona en conflicto")
    void rechazaSuperposicion() {
        when(zonaRepository.existsByNombreIgnoreCase("Nueva")).thenReturn(false);
        when(zonaRepository.buscarSuperpuestas(anyString(), anyLong())).thenReturn(List.of(centro));

        assertThatThrownBy(() -> servicio.crear(new ZonaRequest("Nueva", geoJson(), null, null), false))
                .isInstanceOf(ConflictoException.class)
                .hasMessageContaining("Centro")
                .satisfies(e -> assertThat(((ApiException) e).getCodigo()).isEqualTo("ZONA_SUPERPUESTA"));

        verify(zonaRepository, never()).save(any());
    }

    @Test
    @DisplayName("CP-07: con confirmarSuperposicion=true (param o cuerpo) se guarda sin consultar intersecciones")
    void permiteSuperposicionConfirmada() {
        when(zonaRepository.existsByNombreIgnoreCase("Nueva")).thenReturn(false);
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        ZonaResponse porParametro = servicio.crear(new ZonaRequest("Nueva", geoJson(), null, null), true);
        ZonaResponse porCuerpo = servicio.crear(new ZonaRequest("Nueva", geoJson(), null, true), false);

        assertThat(porParametro.nombre()).isEqualTo("Nueva");
        assertThat(porCuerpo.activa()).isTrue();
        verify(zonaRepository, never()).buscarSuperpuestas(anyString(), anyLong());
    }

    @Test
    @DisplayName("una zona que no se superpone se guarda")
    void guardaSiNoHaySuperposicion() {
        when(zonaRepository.existsByNombreIgnoreCase("Nueva")).thenReturn(false);
        when(zonaRepository.buscarSuperpuestas(anyString(), anyLong())).thenReturn(List.of());
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        ZonaResponse creada = servicio.crear(new ZonaRequest("Nueva", geoJson(), null, null), false);

        assertThat(creada.area()).containsEntry("type", "Polygon");
    }

    @Test
    @DisplayName("CP-08: al editar, la zona no se compara consigo misma")
    void edicionExcluyeLaPropiaZona() {
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(centro));
        when(zonaRepository.findByNombreIgnoreCase("Centro")).thenReturn(Optional.of(centro));
        when(zonaRepository.buscarSuperpuestas(anyString(), eq(1L))).thenReturn(List.of());
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        servicio.actualizar(1L, new ZonaRequest("Centro", geoJson(), null, null), false);

        verify(zonaRepository).buscarSuperpuestas(anyString(), eq(1L));
    }

    @Test
    @DisplayName("al editar tambien se rechaza la superposicion con otras zonas")
    void edicionRechazaSuperposicion() {
        Zona norte = Fabrica.zona(2L, "Norte");
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(centro));
        when(zonaRepository.findByNombreIgnoreCase("Centro")).thenReturn(Optional.of(centro));
        when(zonaRepository.buscarSuperpuestas(anyString(), eq(1L))).thenReturn(List.of(norte));

        assertThatThrownBy(() -> servicio.actualizar(1L, new ZonaRequest("Centro", geoJson(), null, null), false))
                .isInstanceOf(ConflictoException.class).hasMessageContaining("Norte");
    }

    @Test
    @DisplayName("no se permiten dos zonas con el mismo nombre")
    void nombreDuplicado() {
        when(zonaRepository.existsByNombreIgnoreCase("Centro")).thenReturn(true);

        assertThatThrownBy(() -> servicio.crear(new ZonaRequest("Centro", geoJson(), null, null), false))
                .isInstanceOf(ConflictoException.class);
    }

    @Test
    @DisplayName("un GeoJSON con el anillo sin cerrar es una solicitud invalida")
    void geoJsonInvalido() {
        Map<String, Object> abierto = Map.of("type", "Polygon", "coordinates", List.of(List.of(
                List.of(-78.62, -1.24), List.of(-78.61, -1.24), List.of(-78.61, -1.23), List.of(-78.62, -1.23))));
        when(zonaRepository.existsByNombreIgnoreCase("Nueva")).thenReturn(false);

        assertThatThrownBy(() -> servicio.crear(new ZonaRequest("Nueva", abierto, null, null), false))
                .isInstanceOf(SolicitudInvalidaException.class);
    }
}
