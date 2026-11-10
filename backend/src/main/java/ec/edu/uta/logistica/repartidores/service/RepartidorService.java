package ec.edu.uta.logistica.repartidores.service;

import java.util.List;

import ec.edu.uta.logistica.common.exception.RecursoNoEncontradoException;
import ec.edu.uta.logistica.repartidores.dto.RepartidorRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorResponse;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.repartidores.repository.RepartidorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RepartidorService {

    private final RepartidorRepository repartidorRepository;

    public RepartidorService(RepartidorRepository repartidorRepository) {
        this.repartidorRepository = repartidorRepository;
    }

    @Transactional(readOnly = true)
    public List<RepartidorResponse> listar() {
        return repartidorRepository.findByActivoTrueOrderByNombres().stream().map(RepartidorResponse::desde).toList();
    }

    @Transactional(readOnly = true)
    public RepartidorResponse obtener(Long id) {
        return RepartidorResponse.desde(buscar(id));
    }

    @Transactional
    public RepartidorResponse crear(RepartidorRequest solicitud) {
        int capacidad = solicitud.capacidadMaxima() != null ? solicitud.capacidadMaxima()
                : Repartidor.CAPACIDAD_POR_DEFECTO;
        boolean disponible = solicitud.disponible() == null || solicitud.disponible();
        Repartidor repartidor = new Repartidor(solicitud.nombres().trim(), solicitud.telefono().trim(), disponible,
                capacidad);
        return RepartidorResponse.desde(repartidorRepository.save(repartidor));
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
        return RepartidorResponse.desde(repartidorRepository.save(repartidor));
    }

    @Transactional
    public RepartidorResponse cambiarDisponibilidad(Long id, boolean disponible) {
        Repartidor repartidor = buscar(id);
        repartidor.setDisponible(disponible);
        return RepartidorResponse.desde(repartidorRepository.save(repartidor));
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
}
