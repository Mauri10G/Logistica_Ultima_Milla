package ec.edu.uta.logistica.rutas.algoritmo;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import org.locationtech.jts.geom.Point;
import org.springframework.stereotype.Component;

/**
 * Estrategia inicial (a confirmar por el equipo):
 * <ol>
 *   <li>Agrupa los pendientes por (fecha de entrega, zona).</li>
 *   <li>Parte cada grupo en clusters de hasta {@code maxPedidos} por cercania: toma como semilla el pedido mas
 *       alejado del centroide de los que quedan y le suma sus vecinos mas cercanos.</li>
 *   <li>Ordena las paradas de cada cluster por vecino mas cercano, empezando por el pedido con la hora mas
 *       temprana.</li>
 *   <li>Asigna cada ruta al repartidor disponible con menos carga (empate: menor id).</li>
 * </ol>
 * Es determinista: ante empates se desempata por id de pedido / repartidor.
 */
@Component
public class ClusterPorZonaVecinoMasCercano implements EstrategiaArmadoRutas {

    private record Clave(LocalDate fecha, Long zonaId) {
    }

    @Override
    public List<RutaPlanificada> planificar(List<Pedido> pendientes, List<Repartidor> repartidores,
                                            Map<Long, Integer> cargaActual, int maxPedidos) {
        if (maxPedidos < 1) {
            throw new IllegalArgumentException("maxPedidos debe ser al menos 1");
        }
        if (pendientes.isEmpty()) {
            return List.of();
        }
        if (repartidores.isEmpty()) {
            throw new IllegalStateException("No hay repartidores disponibles");
        }

        Map<Long, Integer> carga = new HashMap<>(cargaActual);
        List<RutaPlanificada> rutas = new ArrayList<>();
        for (List<Pedido> grupo : agruparPorZonaYFecha(pendientes).values()) {
            for (List<Pedido> cluster : partirPorCercania(grupo, maxPedidos)) {
                Repartidor repartidor = repartidorConMenosCarga(repartidores, carga);
                carga.merge(repartidor.getId(), cluster.size(), Integer::sum);
                rutas.add(new RutaPlanificada(cluster.get(0).getZona(), repartidor, ordenarPorVecinoMasCercano(cluster)));
            }
        }
        return rutas;
    }

    private Map<Clave, List<Pedido>> agruparPorZonaYFecha(List<Pedido> pendientes) {
        Map<Clave, List<Pedido>> grupos = new TreeMap<>(Comparator.comparing(Clave::fecha)
                .thenComparing(Clave::zonaId, Comparator.nullsFirst(Comparator.naturalOrder())));
        for (Pedido pedido : pendientes) {
            grupos.computeIfAbsent(new Clave(pedido.getFechaEntrega(), pedido.getZona().getId()),
                    k -> new ArrayList<>()).add(pedido);
        }
        return grupos;
    }

    private List<List<Pedido>> partirPorCercania(List<Pedido> grupo, int maxPedidos) {
        List<Pedido> restantes = new ArrayList<>(grupo);
        restantes.sort(PorId.INSTANCIA);
        List<List<Pedido>> clusters = new ArrayList<>();

        while (!restantes.isEmpty()) {
            Point centroide = centroide(restantes);
            Pedido semilla = restantes.stream()
                    .max(Comparator.comparingDouble((Pedido p) -> GeoUtil.distanciaMetros(p.getUbicacion(), centroide))
                            .thenComparing(PorId.INSTANCIA.reversed()))
                    .orElseThrow();
            restantes.remove(semilla);

            List<Pedido> cluster = new ArrayList<>();
            cluster.add(semilla);
            restantes.sort(Comparator.comparingDouble((Pedido p) -> GeoUtil.distanciaMetros(p.getUbicacion(),
                    semilla.getUbicacion())).thenComparing(PorId.INSTANCIA));
            while (cluster.size() < maxPedidos && !restantes.isEmpty()) {
                cluster.add(restantes.remove(0));
            }
            clusters.add(cluster);
        }
        return clusters;
    }

    private List<Pedido> ordenarPorVecinoMasCercano(List<Pedido> cluster) {
        List<Pedido> pendientes = new ArrayList<>(cluster);
        Pedido actual = pendientes.stream()
                .min(Comparator.comparing(Pedido::getHoraEntrega).thenComparing(PorId.INSTANCIA))
                .orElseThrow();
        pendientes.remove(actual);

        List<Pedido> orden = new ArrayList<>();
        orden.add(actual);
        while (!pendientes.isEmpty()) {
            Pedido desde = actual;
            actual = pendientes.stream()
                    .min(Comparator.comparingDouble((Pedido p) -> GeoUtil.distanciaMetros(desde.getUbicacion(),
                            p.getUbicacion())).thenComparing(PorId.INSTANCIA))
                    .orElseThrow();
            pendientes.remove(actual);
            orden.add(actual);
        }
        return orden;
    }

    private Repartidor repartidorConMenosCarga(List<Repartidor> repartidores, Map<Long, Integer> carga) {
        return repartidores.stream()
                .min(Comparator.comparingInt((Repartidor r) -> carga.getOrDefault(r.getId(), 0))
                        .thenComparing(Repartidor::getId, Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElseThrow();
    }

    private Point centroide(List<Pedido> pedidos) {
        double lat = pedidos.stream().mapToDouble(p -> p.getUbicacion().getY()).average().orElse(0);
        double lng = pedidos.stream().mapToDouble(p -> p.getUbicacion().getX()).average().orElse(0);
        return GeoUtil.punto(lat, lng);
    }

    /** Desempate estable por id (los pedidos aun sin guardar tienen id nulo). */
    private static final class PorId implements Comparator<Pedido> {
        private static final PorId INSTANCIA = new PorId();
        private static final Comparator<Long> IDS = Comparator.nullsFirst(Comparator.naturalOrder());

        @Override
        public int compare(Pedido a, Pedido b) {
            return IDS.compare(a.getId(), b.getId());
        }
    }
}
