package ec.edu.uta.logistica.seguridad.dto;

import java.time.Instant;

import ec.edu.uta.logistica.seguridad.entity.Rol;

/**
 * Respuesta de {@code POST /api/auth/login} (contrato en docs/api-auth.md).
 *
 * @param repartidorId solo para COURIER; nulo para STAFF
 * @param expiraEn     instante (UTC) en que vence el token
 */
public record LoginResponse(String token, Rol rol, Long repartidorId, Instant expiraEn) {
}
