package ec.edu.uta.logistica.repartidores.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.common.exception.SolicitudInvalidaException;
import ec.edu.uta.logistica.repartidores.dto.RepartidorAltaRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorResponse;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.seguridad.entity.Usuario;
import ec.edu.uta.logistica.seguridad.repository.UsuarioRepository;
import ec.edu.uta.logistica.testutil.Fabrica;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/** Gestion de repartidores: alta (con su usuario), edicion parcial, disponibilidad y baja logica. */
@ExtendWith(MockitoExtension.class)
class RepartidorServiceTest {

    @Mock
    private RepartidorRepository repartidorRepository;
    @Mock
    private UsuarioRepository usuarioRepository;

    private final PasswordEncoder cifrador = new BCryptPasswordEncoder(4);
    private RepartidorService servicio;

    @BeforeEach
    void preparar() {
        servicio = new RepartidorService(repartidorRepository, usuarioRepository, cifrador);
    }

    private void guardaLoQueRecibe() {
        when(repartidorRepository.save(any(Repartidor.class))).thenAnswer(i -> i.getArgument(0));
    }

    /** Alta de prueba con usuario y clave validos. */
    private static RepartidorAltaRequest alta(String nombres, String telefono, Integer capacidad, Boolean disponible) {
        return new RepartidorAltaRequest(nombres, telefono, capacidad, disponible, "ana.ruiz", "clave123");
    }

    /** El repartidor guardado recibe su id, como lo haria la base. */
    private void guardaRepartidorConId(long id) {
        when(repartidorRepository.save(any(Repartidor.class))).thenAnswer(i -> {
            Repartidor r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", id);
            return r;
        });
    }

    @Test
    @DisplayName("alta sin capacidad ni disponibilidad: capacidad 4, disponible y sin espacios sobrantes")
    void altaConValoresPorDefecto() {
        guardaLoQueRecibe();

        RepartidorResponse creado = servicio.crear(alta("  Ana Ruiz ", " 0990000001 ", null, null));

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

        RepartidorResponse creado = servicio.crear(alta("Ana", "099", 6, false));

        assertThat(creado.capacidadMaxima()).isEqualTo(6);
        assertThat(creado.disponible()).isFalse();
    }

    @Test
    @DisplayName("alta: crea el usuario COURIER del nuevo repartidor con la clave cifrada; la respuesta trae solo el usuario")
    void altaCreaElUsuarioCourier() {
        guardaRepartidorConId(7L);
        when(usuarioRepository.buscarPorUsuario("ana.ruiz")).thenReturn(Optional.empty());

        RepartidorResponse creado = servicio.crear(alta("Ana Ruiz", "0990000001", null, null));

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).saveAndFlush(captor.capture());
        Usuario usuario = captor.getValue();
        assertThat(usuario.getUsuario()).isEqualTo("ana.ruiz");
        assertThat(usuario.getRol()).isEqualTo(Rol.COURIER);
        assertThat(usuario.getRepartidorId()).isEqualTo(7L);
        assertThat(usuario.isActivo()).isTrue();
        assertThat(usuario.getClave()).isNotEqualTo("clave123");
        assertThat(cifrador.matches("clave123", usuario.getClave())).isTrue();
        assertThat(creado.usuario()).isEqualTo("ana.ruiz");
        assertThat(creado.toString()).doesNotContain("clave123").doesNotContain(usuario.getClave());
    }

    @Test
    @DisplayName("alta con un usuario que ya existe (sin importar mayusculas): 409 USUARIO_DUPLICADO y no guarda nada")
    void altaConUsuarioRepetido() {
        when(usuarioRepository.buscarPorUsuario("carlos"))
                .thenReturn(Optional.of(new Usuario("Carlos", "hash", Rol.COURIER, 1L)));
        var solicitud = new RepartidorAltaRequest("Otro", "099", null, null, "carlos", "clave123");

        assertThatThrownBy(() -> servicio.crear(solicitud)).isInstanceOf(ConflictoException.class)
                .hasMessageContaining("'carlos' ya existe")
                .extracting(e -> ((ConflictoException) e).getCodigo()).isEqualTo("USUARIO_DUPLICADO");
        verify(repartidorRepository, never()).save(any());
        verify(usuarioRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("alta: si dos altas chocan en el indice unico del usuario, 409 en vez de un error interno")
    void altaConCarreraEnElIndiceUnico() {
        guardaRepartidorConId(7L);
        when(usuarioRepository.buscarPorUsuario("ana.ruiz")).thenReturn(Optional.empty());
        when(usuarioRepository.saveAndFlush(any(Usuario.class))).thenThrow(new DataIntegrityViolationException("uq"));
        var solicitud = alta("Ana", "099", null, null);

        assertThatThrownBy(() -> servicio.crear(solicitud)).isInstanceOf(ConflictoException.class)
                .hasMessageContaining("ya existe");
    }

    @Test
    @DisplayName("alta con una clave de mas de 72 bytes (limite de BCrypt) -> 400 y no guarda nada")
    void altaConClaveDemasiadoLarga() {
        var solicitud = new RepartidorAltaRequest("Ana", "099", null, null, "ana.ruiz", "ñ".repeat(40));

        assertThatThrownBy(() -> servicio.crear(solicitud)).isInstanceOf(SolicitudInvalidaException.class);
        verify(repartidorRepository, never()).save(any());
        verify(usuarioRepository, never()).buscarPorUsuario(anyString());
    }

    @Test
    @DisplayName("listar y obtener traen el usuario de cada repartidor (null si no tiene cuenta)")
    void consultasTraenElUsuario() {
        Repartidor carlos = Fabrica.repartidor(1L, "Carlos");
        Repartidor luis = Fabrica.repartidor(2L, "Luis");
        when(repartidorRepository.findByActivoTrueOrderByNombres()).thenReturn(List.of(carlos, luis));
        when(repartidorRepository.findById(1L)).thenReturn(Optional.of(carlos));
        when(usuarioRepository.findByRepartidorIdIn(List.of(1L, 2L)))
                .thenReturn(List.of(new Usuario("carlos", "hash", Rol.COURIER, 1L)));
        when(usuarioRepository.findByRepartidorId(1L))
                .thenReturn(Optional.of(new Usuario("carlos", "hash", Rol.COURIER, 1L)));

        assertThat(servicio.listar()).extracting(RepartidorResponse::usuario).containsExactly("carlos", null);
        assertThat(servicio.obtener(1L).usuario()).isEqualTo("carlos");
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
