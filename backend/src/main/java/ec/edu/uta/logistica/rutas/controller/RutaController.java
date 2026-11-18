package ec.edu.uta.logistica.rutas.controller;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.service.ArmadoRutasService;
import ec.edu.uta.logistica.rutas.service.RutaService;
import ec.edu.uta.logistica.seguridad.service.ControlAcceso;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rutas")
public class RutaController {

    private final ArmadoRutasService armadoRutasService;
    private final RutaService rutaService;
    private final ControlAcceso controlAcceso;

    public RutaController(ArmadoRutasService armadoRutasService, RutaService rutaService,
                          ControlAcceso controlAcceso) {
        this.armadoRutasService = armadoRutasService;
        this.rutaService = rutaService;
        this.controlAcceso = controlAcceso;
    }

    /** Dispara manualmente el armado de rutas de una fecha de entrega (YYYY-MM-DD). */
    @PostMapping("/armar")
    public List<RutaResponse> armar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return armadoRutasService.armar(fecha);
    }

    @GetMapping
    public List<RutaResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return rutaService.listarPorFecha(fecha);
    }

    /** STAFF ve cualquier ruta; un COURIER solo las suyas (403). */
    @GetMapping("/{id}")
    public RutaResponse obtener(@PathVariable Long id) {
        RutaResponse ruta = rutaService.obtener(id);
        controlAcceso.exigirRepartidorPropio(ruta.repartidorId());
        return ruta;
    }

    /** Inserta un pedido PENDIENTE en una ruta existente con espacio, o crea una ruta nueva. */
    @PostMapping("/ultimo-momento/{pedidoId}")
    public RutaResponse insertarUltimoMomento(@PathVariable Long pedidoId) {
        return rutaService.insertarUltimoMomento(pedidoId);
    }
}
