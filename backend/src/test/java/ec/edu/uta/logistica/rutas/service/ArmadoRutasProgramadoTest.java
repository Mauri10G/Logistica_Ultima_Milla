package ec.edu.uta.logistica.rutas.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import ec.edu.uta.logistica.common.config.LogisticaProperties;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Armado programado (@Scheduled a las 18:00): fecha que arma y que un fallo nunca tumba al scheduler. */
@ExtendWith(MockitoExtension.class)
class ArmadoRutasProgramadoTest {

    // 2027-02-13 18:00 en Guayaquil (23:00 UTC)
    private static final Clock RELOJ = Clock.fixed(Instant.parse("2027-02-13T23:00:00Z"),
            ZoneId.of("America/Guayaquil"));

    @Mock
    private ArmadoRutasService armadoRutasService;

    private ArmadoRutasProgramado programado;

    @BeforeEach
    void preparar() {
        LogisticaProperties propiedades = new LogisticaProperties("America/Guayaquil",
                new LogisticaProperties.Rutas(4, new LogisticaProperties.Armado(true, "0 0 18 * * *", 1)),
                new LogisticaProperties.Cors(List.of()));
        programado = new ArmadoRutasProgramado(armadoRutasService, propiedades, RELOJ);
    }

    @Test
    @DisplayName("arma las rutas del dia siguiente segun dias-adelante (San Valentin a las 18:00 del 13)")
    void armaElDiaSiguiente() {
        when(armadoRutasService.armar(LocalDate.of(2027, 2, 14))).thenReturn(List.of());

        programado.armarRutasProgramado();

        verify(armadoRutasService).armar(LocalDate.of(2027, 2, 14));
    }

    @Test
    @DisplayName("una regla de negocio (sin repartidores) o un error inesperado se registran y no se propagan")
    void noPropagaErrores() {
        LocalDate manana = LocalDate.of(2027, 2, 14);
        when(armadoRutasService.armar(manana))
                .thenThrow(new ReglaNegocioException("SIN_REPARTIDORES", "No hay repartidores"))
                .thenThrow(new IllegalStateException("base caida"));

        assertThatCode(programado::armarRutasProgramado).doesNotThrowAnyException();
        assertThatCode(programado::armarRutasProgramado).doesNotThrowAnyException();
    }
}
