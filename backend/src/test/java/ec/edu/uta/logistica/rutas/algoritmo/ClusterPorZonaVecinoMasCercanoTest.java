package ec.edu.uta.logistica.rutas.algoritmo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ClusterPorZonaVecinoMasCercanoTest {

    private static final LocalDate FECHA = LocalDate.of(2027, 2, 14);

    private final ClusterPorZonaVecinoMasCercano estrategia = new ClusterPorZonaVecinoMasCercano();
    private final Zona centro = Fabrica.zona(1L, "Centro");
    private final Zona norte = Fabrica.zona(2L, "Norte");
    private final List<Repartidor> repartidores = List.of(Fabrica.repartidor(1L, "Carlos"),
            Fabrica.repartidor(2L, "Luis"), Fabrica.repartidor(3L, "Andrea"));

    @Test
    @DisplayName("ninguna ruta supera el maximo y cada pedido aparece exactamente una vez")
    void respetaElMaximoYNoDuplica() {
        List<Pedido> pedidos = pedidosEnZona(centro, 1, 10);

        List<RutaPlanificada> rutas = estrategia.planificar(pedidos, repartidores, Map.of(), 4);

        assertThat(rutas).extracting(r -> r.paradas().size()).containsExactly(4, 4, 2);
        List<Pedido> todas = rutas.stream().flatMap(r -> r.paradas().stream()).toList();
        assertThat(todas).hasSize(10).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(pedidos);
    }

    @Test
    @DisplayName("zonas con pocos pedidos generan rutas de 1 o 2 pedidos y las zonas no se mezclan")
    void agrupaPorZona() {
        List<Pedido> pedidos = new ArrayList<>(pedidosEnZona(centro, 1, 2));
        pedidos.add(Fabrica.pedido(10L, norte, FECHA, LocalTime.of(9, 0), -1.20, -78.60));

        List<RutaPlanificada> rutas = estrategia.planificar(pedidos, repartidores, Map.of(), 4);

        assertThat(rutas).hasSize(2);
        assertThat(rutas).extracting(r -> r.zona().getNombre()).containsExactly("Centro", "Norte");
        assertThat(rutas).extracting(r -> r.paradas().size()).containsExactly(2, 1);
        assertThat(rutas).allSatisfy(r -> assertThat(r.paradas()).allMatch(p -> p.getZona() == r.zona()));
    }

    @Test
    @DisplayName("los pedidos de fechas distintas no se mezclan en una ruta")
    void agrupaPorFecha() {
        List<Pedido> pedidos = List.of(
                Fabrica.pedido(1L, centro, FECHA, LocalTime.of(9, 0), -1.24, -78.62),
                Fabrica.pedido(2L, centro, FECHA.plusDays(1), LocalTime.of(9, 0), -1.24, -78.62));

        List<RutaPlanificada> rutas = estrategia.planificar(pedidos, repartidores, Map.of(), 4);

        assertThat(rutas).hasSize(2);
    }

    @Test
    @DisplayName("el particionado es por cercania: dos grupos separados no se mezclan")
    void particionaPorCercania() {
        List<Pedido> pedidos = new ArrayList<>();
        // grupo A al oeste, grupo B al este (~2 km), 3 pedidos cada uno; ids intercalados a proposito
        pedidos.add(Fabrica.pedido(1L, centro, FECHA, LocalTime.of(9, 0), -1.2400, -78.6250));
        pedidos.add(Fabrica.pedido(2L, centro, FECHA, LocalTime.of(9, 0), -1.2400, -78.6050));
        pedidos.add(Fabrica.pedido(3L, centro, FECHA, LocalTime.of(9, 0), -1.2401, -78.6249));
        pedidos.add(Fabrica.pedido(4L, centro, FECHA, LocalTime.of(9, 0), -1.2401, -78.6051));
        pedidos.add(Fabrica.pedido(5L, centro, FECHA, LocalTime.of(9, 0), -1.2402, -78.6248));
        pedidos.add(Fabrica.pedido(6L, centro, FECHA, LocalTime.of(9, 0), -1.2402, -78.6052));

        List<RutaPlanificada> rutas = estrategia.planificar(pedidos, repartidores, Map.of(), 3);

        List<List<Long>> idsPorRuta = rutas.stream()
                .map(r -> r.paradas().stream().map(Pedido::getId).sorted().toList()).toList();
        assertThat(idsPorRuta).containsExactlyInAnyOrder(List.of(1L, 3L, 5L), List.of(2L, 4L, 6L));
    }

    @Test
    @DisplayName("las paradas se ordenan por vecino mas cercano, empezando por la hora mas temprana")
    void ordenaPorVecinoMasCercano() {
        // Sobre una linea oeste->este; el de hora mas temprana es el de en medio (id 2)
        Pedido p1 = Fabrica.pedido(1L, centro, FECHA, LocalTime.of(11, 0), -1.24, -78.6200);
        Pedido p2 = Fabrica.pedido(2L, centro, FECHA, LocalTime.of(9, 0), -1.24, -78.6190);
        Pedido p3 = Fabrica.pedido(3L, centro, FECHA, LocalTime.of(10, 0), -1.24, -78.6170);
        Pedido p4 = Fabrica.pedido(4L, centro, FECHA, LocalTime.of(12, 0), -1.24, -78.6100);

        List<RutaPlanificada> rutas = estrategia.planificar(List.of(p4, p3, p2, p1), repartidores, Map.of(), 4);

        assertThat(rutas).hasSize(1);
        assertThat(rutas.get(0).paradas()).containsExactly(p2, p1, p3, p4);
    }

    @Test
    @DisplayName("asigna cada ruta al repartidor disponible con menos carga")
    void asignaAlRepartidorConMenosCarga() {
        List<Pedido> pedidos = pedidosEnZona(centro, 1, 9); // 3 rutas de 4, 4 y 1

        // Carlos ya tiene 6 pedidos y Luis 2; Andrea 0
        List<RutaPlanificada> rutas = estrategia.planificar(pedidos, repartidores, Map.of(1L, 6, 2L, 2), 4);

        // 1a ruta (4) -> Andrea (0); 2a ruta -> Luis (2 < 4); 3a ruta (1) -> Andrea (4 < 6)
        assertThat(rutas.get(0).repartidor().getNombres()).isEqualTo("Andrea");
        assertThat(rutas.get(1).repartidor().getNombres()).isEqualTo("Luis");
        Map<String, Integer> cargaFinal = rutas.stream().collect(Collectors.groupingBy(
                r -> r.repartidor().getNombres(), Collectors.summingInt(r -> r.paradas().size())));
        assertThat(cargaFinal.get("Carlos")).isNull(); // el mas cargado no recibio rutas
    }

    @Test
    @DisplayName("sin pedidos devuelve vacio y sin repartidores lanza IllegalStateException")
    void casosLimite() {
        assertThat(estrategia.planificar(List.of(), repartidores, Map.of(), 4)).isEmpty();
        assertThatThrownBy(() -> estrategia.planificar(pedidosEnZona(centro, 1, 2), List.of(), Map.of(), 4))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> estrategia.planificar(pedidosEnZona(centro, 1, 2), repartidores, Map.of(), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private List<Pedido> pedidosEnZona(Zona zona, long desdeId, int cantidad) {
        List<Pedido> pedidos = new ArrayList<>();
        for (int i = 0; i < cantidad; i++) {
            long id = desdeId + i;
            pedidos.add(Fabrica.pedido(id, zona, FECHA, LocalTime.of(8, 0).plusMinutes(id), -1.24 + i * 0.0005,
                    -78.62 + i * 0.0003));
        }
        return pedidos;
    }
}
