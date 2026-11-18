package ec.edu.uta.logistica.repartidores.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.repartidores.dto.RepartidorRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorResponse;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.testutil.Fabrica;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Gestion de repartidores: alta con valores por defecto, edicion parcial, disponibilidad y baja logica. */
@ExtendWith(MockitoExtension.class)
class RepartidorServiceTest {

    @Mock
    private RepartidorRepository repartidorRepository;

    private RepartidorService servicio;

    @BeforeEach
    void preparar() {
        servicio = new RepartidorService(repartidorRepository);
    }

    private void guardaLoQueRecibe() {
        when(repartidorRepository.save(any(Repartidor.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("alta sin capacidad ni disponibilidad: capacidad 4, disponible y sin espacios sobrantes")
    void altaConValoresPorDefecto() {
        guardaLoQueRecibe();

        RepartidorResponse creado = servicio.crear(new RepartidorRequest("  Ana Ruiz ", " 0990000001 ", null, null));

        assertThat(creado.nombres()).isEqualTo("Ana Ruiz");
        assertThat(creado.telefono()).isEqualTo("0990000001");
        assertThat(creado.capacidadMaxima()).isEqualTo(Repartidor.CAPACIDAD_POR_DEFECTO);
        assertThat(creado.disponible()).isTrue();
        assertThat(creado.activo()).isTrue();
    }

    @Test
    @DisplayName("alta con capacidad y disponibilidad explicitas")
    void altaConValores() {
        guardaLoQueRecibe();

        RepartidorResponse creado = servicio.crear(new RepartidorRequest("Ana", "099", 6, false));

        assertThat(creado.capacidadMaxima()).isEqualTo(6);
        assertThat(creado.disponible()).isFalse();
    }

    @Test
    @DisplayName("editar: cambia nombre y telefono; capacidad y disponibilidad solo si vienen")
    void edicionParcial() {
        Repartidor carlos = Fabrica.repartidor(1L, "Carlos");
        when(repartidorRepository.findById(1L)).thenReturn(Optional.of(carlos));
        guardaLoQueRecibe();

        servicio.actualizar(1L, new RepartidorRequest("Carlos M", "0991", null, null));
        assertThat(carlos.getCapacidadMaxima()).isEqualTo(4);
        assertThat(carlos.isDisponible()).isTrue();

        RepartidorResponse editado = servicio.actualizar(1L, new RepartidorRequest("Carlos M", "0991", 5, false));
        assertThat(editado.nombres()).isEqualTo("Carlos M");
        assertThat(editado.capacidadMaxima()).isEqualTo(5);
        assertThat(editado.disponible()).isFalse();
    }

    @Test
    @DisplayName("disponibilidad, listado y consulta")
    void disponibilidadYConsultas() {
        Repartidor carlos = Fabrica.repartidor(1L, "Carlos");
        when(repartidorRepository.findById(1L)).thenReturn(Optional.of(carlos));
        when(repartidorRepository.findByActivoTrueOrderByNombres()).thenReturn(List.of(carlos));
        guardaLoQueRecibe();

        assertThat(servicio.cambiarDisponibilidad(1L, false).disponible()).isFalse();
        assertThat(servicio.listar()).extracting(RepartidorResponse::nombres).containsExactly("Carlos");
        assertThat(servicio.obtener(1L).id()).isEqualTo(1L);
    }

    @Test
    @DisplayName("baja logica: queda inactivo y no disponible, y ya no se encuentra (404)")
    void bajaLogica() {
        Repartidor carlos = Fabrica.repartidor(1L, "Carlos");
        when(repartidorRepository.findById(1L)).thenReturn(Optional.of(carlos));
        guardaLoQueRecibe();

        servicio.desactivar(1L);

        assertThat(carlos.isActivo()).isFalse();
        assertThat(carlos.isDisponible()).isFalse();
        assertThatThrownBy(() -> servicio.obtener(1L)).isInstanceOf(RecursoNoEncontradoException.class);
    }

    @Test
    @DisplayName("un repartidor inexistente -> 404 y no se guarda nada")
    void inexistente() {
        when(repartidorRepository.findById(9L)).thenReturn(Optional.empty());
        var solicitud = new RepartidorRequest("X", "0", null, null);

        assertThatThrownBy(() -> servicio.actualizar(9L, solicitud))
                .isInstanceOf(RecursoNoEncontradoException.class).hasMessageContaining("9");
        verify(repartidorRepository, never()).save(any());
    }
}
