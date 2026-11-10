package ec.edu.uta.logistica.seguimiento.controller;

import java.util.List;

import ec.edu.uta.logistica.seguimiento.dto.HistorialResponse;
import ec.edu.uta.logistica.seguimiento.service.SeguimientoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/seguimiento")
public class SeguimientoController {

    private final SeguimientoService seguimientoService;

    public SeguimientoController(SeguimientoService seguimientoService) {
        this.seguimientoService = seguimientoService;
    }

    /** Linea de tiempo de estados de un pedido. */
    @GetMapping("/pedidos/{pedidoId}/historial")
    public List<HistorialResponse> historial(@PathVariable Long pedidoId) {
        return seguimientoService.historial(pedidoId);
    }
}
