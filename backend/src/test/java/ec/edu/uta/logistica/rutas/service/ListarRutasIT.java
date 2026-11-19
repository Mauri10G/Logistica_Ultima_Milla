package ec.edu.uta.logistica.rutas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import ec.edu.uta.logistica.IntegrationTestBase;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.dto.PedidoResponse;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.DatosEntrega;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;
import ec.edu.uta.logistica.pedidos.repository.ClienteRepository;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.rutas.dto.RutaResponse;
import ec.edu.uta.logistica.rutas.repository.RutaRepository;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Issue #31: {@code GET /api/rutas?fecha=} no debe consultar ruta por ruta ni pedido por pedido. Usa fechas propias
 * (hoy + 100 y hoy + 101).
 */
class ListarRutasIT extends IntegrationTestBase {

    @Autowired
    private Clock reloj;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private RutaService rutaService;
    @Autowired
    private ArmadoRutasService armadoRutasService;
    @Autowired
    private RutaRepository rutaRepository;
    @Autowired
    private PedidoRepository pedidoRepository;
    @Autowired
    private ClienteRepository clienteRepository;
    @Autowired
    private ZonaRepository zonaRepository;
    @Autowired
    private TransactionTemplate transaccion;
    @Autowired
    private EntityManagerFactory fabrica;

    private void crearPedidos(LocalDate fecha, String zona, int cantidad) {
        Zona z = zonaRepository.findByNombreIgnoreCase(zona).orElseThrow();
        double lat = "Centro".equals(zona) ? -1.2440 : -1.2100;
        double lng = "Centro".equals(zona) ? -78.6200 : -78.6050;
        for (int i = 0; i < cantidad; i++) {
            Cliente cliente = clienteRepository.save(new Cliente("Cliente listado " + zona + " " + i, "0990000000", null));
            pedidoRepository.save(new Pedido(cliente, "Direccion listado " + i,
                    GeoUtil.punto(lat + i * 0.0003, lng + i * 0.0002), z,
                    new DatosEntrega(fecha, LocalTime.of(9, 0).plusMinutes(i), PrioridadPedido.NORMAL),
                    LocalDateTime.now(reloj), true));
        }
    }

    /** Lo que respondia el listado antes del cambio: rutas con sus pedidos por la coleccion perezosa de cada ruta. */
    private List<RutaResponse> respuestaAnterior(LocalDate fecha) {
        return transaccion.execute(estado ->
                rutaRepository.buscarPorFecha(fecha).stream().map(RutaResponse::desde).toList());
    }

    private long consultasAlListar(LocalDate fecha) {
        Statistics estadisticas = fabrica.unwrap(SessionFactory.class).getStatistics();
        estadisticas.setStatisticsEnabled(true);
        estadisticas.clear();
        rutaService.listarPorFecha(fecha);
        return estadisticas.getPrepareStatementCount();
    }

    @Test
    @DisplayName("la respuesta es la misma de antes: mismas rutas, mismos pedidos y en el mismo orden de visita")
    void respuestaIgualALaAnterior() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(100);
        crearPedidos(fecha, "Centro", 10);
        crearPedidos(fecha, "Ingahurco", 6);
        armadoRutasService.armar(fecha);

        List<RutaResponse> actual = rutaService.listarPorFecha(fecha);

        assertThat(actual).hasSize(5); // Centro: 10 pedidos en 3 rutas; Ingahurco: 6 pedidos en 2 rutas
        assertThat(actual).isEqualTo(respuestaAnterior(fecha));
        assertThat(actual).flatExtracting(RutaResponse::pedidos).hasSize(16);
        for (RutaResponse ruta : actual) {
            assertThat(ruta.pedidos()).extracting(PedidoResponse::ordenEnRuta)
                    .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, ruta.pedidos().size())
                            .boxed().toList());
            assertThat(ruta.pedidos()).extracting(PedidoResponse::rutaId).containsOnly(ruta.id());
            assertThat(ruta.pedidos()).extracting(PedidoResponse::zonaId).containsOnly(ruta.zonaId());
            assertThat(ruta.pedidos()).extracting(PedidoResponse::clienteNombres).doesNotContainNull();
        }
    }

    @Test
    @DisplayName("el JSON de GET /api/rutas conserva su forma")
    void jsonConservaSuForma() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(101);
        crearPedidos(fecha, "Centro", 3);
        armadoRutasService.armar(fecha);

        mvc.perform(get("/api/rutas").param("fecha", fecha.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].zonaNombre").value("Centro"))
                .andExpect(jsonPath("$[0].estado").value("ARMADA"))
                .andExpect(jsonPath("$[0].maxPedidos").value(4))
                .andExpect(jsonPath("$[0].repartidorId").isNumber())
                .andExpect(jsonPath("$[0].repartidorNombre").isString())
                .andExpect(jsonPath("$[0].pedidos.length()").value(3))
                .andExpect(jsonPath("$[0].pedidos[0].ordenEnRuta").value(1))
                .andExpect(jsonPath("$[0].pedidos[0].clienteNombres").isString())
                .andExpect(jsonPath("$[0].pedidos[0].zonaNombre").value("Centro"))
                .andExpect(jsonPath("$[0].pedidos[0].rutaId").value(
                        rutaService.listarPorFecha(fecha).get(0).id().intValue()));
    }

    @Test
    @DisplayName("el numero de consultas no crece con la cantidad de rutas ni de pedidos")
    void consultasNoCrecenConLasRutas() {
        LocalDate pocas = LocalDate.now(reloj).plusDays(102);
        LocalDate muchas = LocalDate.now(reloj).plusDays(103);
        crearPedidos(pocas, "Centro", 4);
        armadoRutasService.armar(pocas);
        for (String zona : List.of("Centro", "Ingahurco")) {
            crearPedidos(muchas, zona, 120);
        }
        List<RutaResponse> rutas = armadoRutasService.armar(muchas);
        assertThat(rutas).hasSizeGreaterThanOrEqualTo(60);
        assertThat(rutas.stream().mapToInt(r -> r.pedidos().size()).sum()).isEqualTo(240);

        List<Long> consultas = new ArrayList<>();
        consultasAlListar(pocas); // calienta
        consultas.add(consultasAlListar(pocas));
        consultas.add(consultasAlListar(muchas));

        // 1 ruta (con zona y repartidor) o 60+ rutas: las mismas consultas
        assertThat(consultas.get(1)).isEqualTo(consultas.get(0));
        assertThat(consultas.get(1)).isLessThanOrEqualTo(3);
    }
}
