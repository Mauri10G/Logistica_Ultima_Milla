package ec.edu.uta.logistica.repartidores.controller;

import java.net.URI;
import java.util.List;

import ec.edu.uta.logistica.repartidores.dto.DisponibilidadRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorResponse;
import ec.edu.uta.logistica.repartidores.service.RepartidorService;
import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.service.RutaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/repartidores")
public class RepartidorController {

    private final RepartidorService repartidorService;
    private final RutaService rutaService;

    public RepartidorController(RepartidorService repartidorService, RutaService rutaService) {
        this.repartidorService = repartidorService;
        this.rutaService = rutaService;
    }

    @GetMapping
    public List<RepartidorResponse> listar() {
        return repartidorService.listar();
    }

    @GetMapping("/{id}")
    public RepartidorResponse obtener(@PathVariable Long id) {
        return repartidorService.obtener(id);
    }

    @PostMapping
    public ResponseEntity<RepartidorResponse> crear(@Valid @RequestBody RepartidorRequest solicitud) {
        RepartidorResponse creado = repartidorService.crear(solicitud);
        return ResponseEntity.created(URI.create("/api/repartidores/" + creado.id())).body(creado);
    }

    @PutMapping("/{id}")
    public RepartidorResponse actualizar(@PathVariable Long id, @Valid @RequestBody RepartidorRequest solicitud) {
        return repartidorService.actualizar(id, solicitud);
    }

    @PatchMapping("/{id}/disponibilidad")
    public RepartidorResponse cambiarDisponibilidad(@PathVariable Long id,
                                                    @Valid @RequestBody DisponibilidadRequest solicitud) {
        return repartidorService.cambiarDisponibilidad(id, solicitud.disponible());
    }

    /** Usado por la app movil: la ruta que el repartidor tiene que recorrer (en curso o la proxima armada). */
    @GetMapping("/{id}/ruta-actual")
    public RutaResponse rutaActual(@PathVariable Long id) {
        repartidorService.obtener(id); // 404 si el repartidor no existe
        return rutaService.rutaActualDe(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        repartidorService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
