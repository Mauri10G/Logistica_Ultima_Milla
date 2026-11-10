package ec.edu.uta.logistica.zonas.controller;

import java.net.URI;
import java.util.List;

import ec.edu.uta.logistica.zonas.dto.ZonaRequest;
import ec.edu.uta.logistica.zonas.dto.ZonaResponse;
import ec.edu.uta.logistica.zonas.service.ZonaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/zonas")
public class ZonaController {

    private final ZonaService zonaService;

    public ZonaController(ZonaService zonaService) {
        this.zonaService = zonaService;
    }

    @GetMapping
    public List<ZonaResponse> listar(@RequestParam(defaultValue = "false") boolean soloActivas) {
        return zonaService.listar(soloActivas);
    }

    @GetMapping("/{id}")
    public ZonaResponse obtener(@PathVariable Long id) {
        return zonaService.obtener(id);
    }

    @PostMapping
    public ResponseEntity<ZonaResponse> crear(@Valid @RequestBody ZonaRequest solicitud,
                                              @RequestParam(defaultValue = "false") boolean confirmarSuperposicion) {
        ZonaResponse creada = zonaService.crear(solicitud, confirmarSuperposicion);
        return ResponseEntity.created(URI.create("/api/zonas/" + creada.id())).body(creada);
    }

    @PutMapping("/{id}")
    public ZonaResponse actualizar(@PathVariable Long id, @Valid @RequestBody ZonaRequest solicitud,
                                   @RequestParam(defaultValue = "false") boolean confirmarSuperposicion) {
        return zonaService.actualizar(id, solicitud, confirmarSuperposicion);
    }

    /** Baja logica (activa = false). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        zonaService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
