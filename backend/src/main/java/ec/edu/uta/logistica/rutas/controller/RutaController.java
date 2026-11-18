package ec.edu.uta.logistica.rutas.controller;

import java.time.LocalDate;
import java.util.List;

import ec.edu.uta.logistica.rutas.dto.CambioRepartidorRequest;
import ec.edu.uta.logistica.rutas.dto.OrdenRutaRequest;
import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.service.AjusteRutasService;
import ec.edu.uta.logistica.rutas.service.ArmadoRutasService;
import ec.edu.uta.logistica.rutas.service.RutaService;
import ec.edu.uta.logistica.seguridad.service.ControlAcceso;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rutas")
public class RutaController {

    private final ArmadoRutasService armadoRutasService;
    private final RutaService rutaService;
    private final AjusteRutasService ajusteRutasService;
    private final ControlAcceso controlAcceso;

    public RutaController(ArmadoRutasService armadoRutasService, RutaService rutaService,
                          AjusteRutasService ajusteRutasService, ControlAcceso controlAcceso) {
        this.armadoRutasService = armadoRutasService;
        this.rutaService = rutaService;
        this.ajusteRutasService = ajusteRutasService;
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

    // ---------------------------------------------------------------- ajustes manuales (solo STAFF, ruta ARMADA)

    /** Cambia el repartidor de la ruta. 422 si no esta disponible; 409 si la ruta ya no esta ARMADA. */
    @PatchMapping("/{id}/repartidor")
    public RutaResponse cambiarRepartidor(@PathVariable Long id, @Valid @RequestBody CambioRepartidorRequest solicitud) {
        return ajusteRutasService.cambiarRepartidor(id, solicitud.repartidorId());
    }

    /** Mueve un pedido a esta ruta (desde otra ruta o desde PENDIENTE). 409 RUTA_LLENA si supera el maximo. */
    @PostMapping("/{id}/pedidos/{pedidoId}")
    public RutaResponse agregarPedido(@PathVariable Long id, @PathVariable Long pedidoId) {
        return ajusteRutasService.agregarPedido(id, pedidoId);
    }

    /** Saca el pedido de la ruta: vuelve a PENDIENTE y sin ruta. */
    @DeleteMapping("/{id}/pedidos/{pedidoId}")
    public RutaResponse quitarPedido(@PathVariable Long id, @PathVariable Long pedidoId) {
        return ajusteRutasService.quitarPedido(id, pedidoId);
    }

    /** Nuevo orden de visita, con todos los pedidos de la ruta: { "pedidos": [12, 7, 9] }. */
    @PutMapping("/{id}/orden")
    public RutaResponse reordenar(@PathVariable Long id, @Valid @RequestBody OrdenRutaRequest solicitud) {
        return ajusteRutasService.reordenar(id, solicitud.pedidos());
    }
}
