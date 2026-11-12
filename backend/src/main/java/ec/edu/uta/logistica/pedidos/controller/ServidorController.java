package ec.edu.uta.logistica.pedidos.controller;

import ec.edu.uta.logistica.pedidos.dto.HoraServidorResponse;
import ec.edu.uta.logistica.pedidos.service.PedidoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Hora oficial del sistema: la web la usa en lugar de la del computador del usuario, que puede modificarse. */
@RestController
@RequestMapping("/api/servidor")
public class ServidorController {

    private final PedidoService pedidoService;

    public ServidorController(PedidoService pedidoService) {
        this.pedidoService = pedidoService;
    }

    @GetMapping("/hora")
    public HoraServidorResponse hora() {
        return pedidoService.horaServidor();
    }
}
