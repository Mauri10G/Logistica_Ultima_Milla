package ec.edu.uta.logistica.pedidos.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Registro/edicion de pedido. El cliente se indica con {@code clienteId} (cliente existente) o con
 * {@code clienteNombres} + {@code clienteTelefono} (se crea uno nuevo).
 */
public record PedidoRequest(
        Long clienteId,
        @Size(max = 150, message = "Los nombres admiten hasta 150 caracteres")
        String clienteNombres,
        @Size(max = 30, message = "El telefono admite hasta 30 caracteres")
        String clienteTelefono,
        @Email(message = "El email no es valido")
        @Size(max = 150, message = "El email admite hasta 150 caracteres")
        String clienteEmail,
        @NotBlank(message = "La direccion es obligatoria")
        @Size(max = 255, message = "La direccion admite hasta 255 caracteres")
        String direccion,
        @NotNull(message = "La latitud es obligatoria")
        @DecimalMin(value = "-90", message = "Latitud fuera de rango")
        @DecimalMax(value = "90", message = "Latitud fuera de rango")
        Double latitud,
        @NotNull(message = "La longitud es obligatoria")
        @DecimalMin(value = "-180", message = "Longitud fuera de rango")
        @DecimalMax(value = "180", message = "Longitud fuera de rango")
        Double longitud,
        @NotNull(message = "La fecha de entrega es obligatoria")
        LocalDate fechaEntrega,
        @NotNull(message = "La hora aproximada de entrega es obligatoria")
        LocalTime horaEntrega,
        PrioridadPedido prioridad,
        Boolean registradoPorPersonal) {
}
