package ec.edu.uta.logistica.pedidos.entity;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Cuando y con que prioridad se entrega un pedido. Agrupa estos datos para que el constructor de {@link Pedido} no
 * tenga demasiados parametros (Sonar java:S107).
 *
 * @param prioridad si es nula se usa {@link PrioridadPedido#NORMAL}
 */
public record DatosEntrega(LocalDate fecha, LocalTime hora, PrioridadPedido prioridad) {
}
