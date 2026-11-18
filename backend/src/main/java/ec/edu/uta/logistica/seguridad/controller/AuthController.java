package ec.edu.uta.logistica.seguridad.controller;

import ec.edu.uta.logistica.seguridad.dto.LoginRequest;
import ec.edu.uta.logistica.seguridad.dto.LoginResponse;
import ec.edu.uta.logistica.seguridad.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** Publico. Devuelve token, rol y repartidorId; 401 CREDENCIALES_INVALIDAS si no coinciden. */
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest solicitud) {
        return authService.login(solicitud);
    }
}
