package ec.edu.uta.logistica.repartidores.service;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RepartidorService {

    public static final String CODIGO_USUARIO_DUPLICADO = "USUARIO_DUPLICADO";
    /** BCrypt solo usa los primeros 72 bytes de la clave: mas que eso se rechaza en vez de truncarlo en silencio. */
    private static final int MAX_BYTES_CLAVE = 72;

    private final RepartidorRepository repartidorRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder cifrador;

    public RepartidorService(RepartidorRepository repartidorRepository, UsuarioRepository usuarioRepository,
                             PasswordEncoder cifrador) {
        this.repartidorRepository = repartidorRepository;
        this.usuarioRepository = usuarioRepository;
        this.cifrador = cifrador;
    }

    @Transactional(readOnly = true)
    public List<RepartidorResponse> listar() {
        List<Repartidor> repartidores = repartidorRepository.findByActivoTrueOrderByNombres();
        Map<Long, String> usuarios = new HashMap<>();
        if (!repartidores.isEmpty()) {
            usuarioRepository.findByRepartidorIdIn(repartidores.stream().map(Repartidor::getId).toList())
                    .forEach(u -> usuarios.put(u.getRepartidorId(), u.getUsuario()));
        }
        return repartidores.stream().map(r -> RepartidorResponse.desde(r, usuarios.get(r.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public RepartidorResponse obtener(Long id) {
        return conUsuario(buscar(id));
    }

    /**
     * Crea el repartidor y su usuario COURIER (con el que entra a la app movil) en una sola transaccion: si el
     * usuario falla, el repartidor tampoco queda guardado.
     */
    @Transactional
    public RepartidorResponse crear(RepartidorAltaRequest solicitud) {
        String nombreUsuario = solicitud.usuario().trim();
        if (solicitud.clave().getBytes(StandardCharsets.UTF_8).length > MAX_BYTES_CLAVE) {
            throw new SolicitudInvalidaException("La clave admite hasta " + MAX_BYTES_CLAVE + " bytes");
        }
        if (usuarioRepository.buscarPorUsuario(nombreUsuario).isPresent()) {
            throw usuarioDuplicado(nombreUsuario);
        }
        int capacidad = solicitud.capacidadMaxima() != null ? solicitud.capacidadMaxima()
                : Repartidor.CAPACIDAD_POR_DEFECTO;
        boolean disponible = solicitud.disponible() == null || solicitud.disponible();
        Repartidor repartidor = repartidorRepository.save(
                new Repartidor(solicitud.nombres().trim(), solicitud.telefono().trim(), disponible, capacidad));
        try {
            usuarioRepository.saveAndFlush(new Usuario(nombreUsuario, cifrador.encode(solicitud.clave()),
                    Rol.COURIER, repartidor.getId()));
        } catch (DataIntegrityViolationException e) {
            // dos altas simultaneas con el mismo usuario: gana una y la otra cae en el indice unico
            throw usuarioDuplicado(nombreUsuario);
        }
        return RepartidorResponse.desde(repartidor, nombreUsuario);
    }

    @Transactional
    public RepartidorResponse actualizar(Long id, RepartidorRequest solicitud) {
        Repartidor repartidor = buscar(id);
        repartidor.setNombres(solicitud.nombres().trim());
        repartidor.setTelefono(solicitud.telefono().trim());
        if (solicitud.capacidadMaxima() != null) {
            repartidor.setCapacidadMaxima(solicitud.capacidadMaxima());
        }
        if (solicitud.disponible() != null) {
            repartidor.setDisponible(solicitud.disponible());
        }
        return conUsuario(repartidorRepository.save(repartidor));
    }

    @Transactional
    public RepartidorResponse cambiarDisponibilidad(Long id, boolean disponible) {
        Repartidor repartidor = buscar(id);
        repartidor.setDisponible(disponible);
        return conUsuario(repartidorRepository.save(repartidor));
    }

    /** Baja logica: las rutas historicas siguen referenciando al repartidor. */
    @Transactional
    public void desactivar(Long id) {
        Repartidor repartidor = buscar(id);
        repartidor.setActivo(false);
        repartidor.setDisponible(false);
        repartidorRepository.save(repartidor);
    }

    private Repartidor buscar(Long id) {
        return repartidorRepository.findById(id)
                .filter(Repartidor::isActivo)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el repartidor con id " + id));
    }

    private RepartidorResponse conUsuario(Repartidor repartidor) {
        String usuario = usuarioRepository.findByRepartidorId(repartidor.getId()).map(Usuario::getUsuario)
                .orElse(null);
        return RepartidorResponse.desde(repartidor, usuario);
    }

    private static ConflictoException usuarioDuplicado(String usuario) {
        return new ConflictoException(CODIGO_USUARIO_DUPLICADO,
                "El usuario '" + usuario + "' ya existe. Elija otro nombre de usuario.");
    }
}
