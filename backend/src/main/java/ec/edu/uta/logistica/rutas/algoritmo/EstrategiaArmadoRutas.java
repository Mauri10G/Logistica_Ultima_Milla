package ec.edu.uta.logistica.rutas.algoritmo;

import java.util.List;
import java.util.Map;

import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;

/**
 * Contrato del algoritmo de armado de rutas. El algoritmo definitivo todavia se va a confirmar:
 * para cambiarlo basta con otra implementacion anotada con {@code @Component} y dejar solo una activa
 * (por ejemplo con {@code @Primary} o {@code @ConditionalOnProperty}).
 *
 * <p>Es una funcion pura (no accede a la base de datos), por lo que se prueba con pruebas unitarias.
 * La transaccion, los bloqueos y la persistencia son responsabilidad de {@code ArmadoRutasService}.
 */
public interface EstrategiaArmadoRutas {

    /**
     * @param pendientes   pedidos PENDIENTE sin ruta (de una o varias zonas y fechas)
     * @param repartidores repartidores disponibles; no vacio
     * @param cargaActual  pedidos ya asignados por id de repartidor (para repartir la carga)
     * @param maxPedidos   maximo de pedidos por ruta
     * @return rutas planificadas; ninguna supera {@code maxPedidos} y cada pedido aparece exactamente una vez
     */
    List<RutaPlanificada> planificar(List<Pedido> pendientes, List<Repartidor> repartidores,
                                     Map<Long, Integer> cargaActual, int maxPedidos);
}
