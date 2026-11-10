package ec.edu.uta.logistica.rutas.algoritmo;

import java.util.List;

import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.zonas.entity.Zona;

/**
 * Resultado de una estrategia: una ruta todavia sin persistir.
 *
 * @param paradas pedidos en el orden en que el repartidor los visita
 */
public record RutaPlanificada(Zona zona, Repartidor repartidor, List<Pedido> paradas) {
}
