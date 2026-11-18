package ec.edu.uta.logistica.rutas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import com.jayway.jsonpath.JsonPath;
import ec.edu.uta.logistica.IntegrationTestBase;
import ec.edu.uta.logistica.pedidos.dto.PedidoRequest;
import ec.edu.uta.logistica.pedidos.dto.PedidoResponse;
import ec.edu.uta.logistica.pedidos.service.PedidoService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Pedido de ultimo momento automatico contra PostGIS: al registrar un pedido para una fecha con rutas armadas se
 * inserta solo. Usa fechas propias (hoy + 80 ... + 89).
 */
class UltimoMomentoAutomaticoIT extends IntegrationTestBase {

    private static final double LAT_CENTRO = -1.2440;
    private static final double LNG_CENTRO = -78.6200;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private PedidoService pedidoService;
    @Autowired
    private ArmadoRutasService armadoRutasService;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private Clock reloj;

    private static PedidoRequest solicitud(LocalDate fecha, int i) {
        return new PedidoRequest(null, "Cliente UM " + i, "0991112223", null, "Direccion UM " + i,
                LAT_CENTRO + i * 0.0002, LNG_CENTRO + i * 0.0001, fecha, LocalTime.of(10, 0), null, null);
    }

    private long registrarPorHttp(LocalDate fecha, int i) throws Exception {
        String cuerpo = """
                {"clienteNombres": "Cliente UM %d", "clienteTelefono": "0991112223", "direccion": "Direccion UM %d",
                 "latitud": %s, "longitud": %s, "fechaEntrega": "%s", "horaEntrega": "10:00"}
                """.formatted(i, i, LAT_CENTRO + i * 0.0002, LNG_CENTRO + i * 0.0001, fecha);
        String respuesta = mvc.perform(post("/api/pedidos").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    @Test
    @DisplayName("sin rutas para la fecha el pedido queda PENDIENTE; con rutas armadas entra solo y llena antes de crear otra")
    void insertaAlRegistrar() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(80);
        long primero = registrarPorHttp(fecha, 0);
        long segundo = registrarPorHttp(fecha, 1);
        mvc.perform(get("/api/pedidos/" + primero)).andExpect(jsonPath("$.estado").value("PENDIENTE"));

        armadoRutasService.armar(fecha); // una ruta con 2 pedidos (maximo 4)

        // de ultimo momento: los dos primeros llenan la ruta existente, el tercero abre una ruta nueva
        String tercero = mvc.perform(post("/api/pedidos").contentType(MediaType.APPLICATION_JSON).content("""
                        {"clienteNombres": "Cliente UM 2", "clienteTelefono": "0991112223", "direccion": "Direccion UM 2",
                         "latitud": -1.2436, "longitud": -78.6198, "fechaEntrega": "%s", "horaEntrega": "10:00"}
                        """.formatted(fecha)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("ASIGNADO"))
                .andExpect(jsonPath("$.ordenEnRuta").value(3))
                .andReturn().getResponse().getContentAsString();
        long rutaInicial = ((Number) JsonPath.read(tercero, "$.rutaId")).longValue();
        registrarPorHttp(fecha, 3);
        long quinto = registrarPorHttp(fecha, 4);

        mvc.perform(get("/api/rutas/" + rutaInicial)).andExpect(jsonPath("$.pedidos", hasSize(4)));
        String quintoJson = mvc.perform(get("/api/pedidos/" + quinto)).andExpect(jsonPath("$.estado").value("ASIGNADO"))
                .andExpect(jsonPath("$.ordenEnRuta").value(1)).andReturn().getResponse().getContentAsString();
        assertThat(((Number) JsonPath.read(quintoJson, "$.rutaId")).longValue()).isNotEqualTo(rutaInicial);
        mvc.perform(get("/api/seguimiento/pedidos/" + quinto + "/historial"))
                .andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].estadoNuevo").value("ASIGNADO"));
        assertThat(jdbc.queryForObject("select count(*) from pedido where id in (?, ?) and estado = 'ASIGNADO'",
                Integer.class, primero, segundo)).isEqualTo(2);
    }

    @Test
    @DisplayName("concurrencia: 12 pedidos de ultimo momento llegan mientras se arman las rutas de la misma fecha")
    void ultimoMomentoMientrasSeArma() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(81);
        // la fecha ya tiene una ruta armada (para que los nuevos se inserten solos) y 9 pendientes esperando al armado
        pedidoService.registrar(solicitud(fecha, 0));
        armadoRutasService.armar(fecha);
        for (int i = 1; i <= 9; i++) {
            jdbc.update("""
                    insert into pedido (cliente_id, direccion, ubicacion, zona_id, fecha_entrega, hora_entrega,
                                        fecha_registro, prioridad, estado, registrado_por_personal)
                    select c.id, 'Pendiente UM', ST_SetSRID(ST_MakePoint(?, ?), 4326), z.id, ?, '11:00', now(),
                           'NORMAL', 'PENDIENTE', true
                    from cliente c, zona z where z.nombre = 'Centro' order by c.id limit 1
                    """, LNG_CENTRO - i * 0.0001, LAT_CENTRO - i * 0.0002, fecha);
        }

        List<Callable<Object>> tareas = new ArrayList<>();
        tareas.add(() -> armadoRutasService.armar(fecha));
        tareas.add(() -> armadoRutasService.armar(fecha));
        for (int i = 10; i < 22; i++) {
            int indice = i;
            tareas.add(() -> pedidoService.registrar(solicitud(fecha, indice)));
        }
        List<Object> resultados = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errores = ejecutarEnParalelo(tareas, resultados);

        assertThat(errores).as("errores durante el armado concurrente").isEmpty();
        assertThat(resultados).filteredOn(PedidoResponse.class::isInstance).hasSize(12)
                .allSatisfy(r -> assertThat(((PedidoResponse) r).rutaId()).as("ruta del pedido").isNotNull());
        // 1 + 9 + 12 = 22 pedidos, todos en exactamente una ruta, ninguna por encima de 4, posiciones sin repetir
        assertThat(jdbc.queryForObject("select count(*) from pedido where fecha_entrega = ?", Integer.class, fecha))
                .isEqualTo(22);
        assertThat(jdbc.queryForObject("""
                select count(*) from pedido where fecha_entrega = ? and (ruta_id is null or estado <> 'ASIGNADO')""",
                Integer.class, fecha)).as("pedidos sin ruta").isZero();
        assertThat(jdbc.queryForList("""
                select r.id from ruta r join pedido p on p.ruta_id = r.id where r.fecha = ?
                group by r.id, r.max_pedidos having count(*) > r.max_pedidos""", Long.class, fecha)).isEmpty();
        assertThat(jdbc.queryForObject("""
                select count(*) from (select ruta_id, orden_en_ruta from pedido where fecha_entrega = ?
                group by 1, 2 having count(*) > 1) t""", Integer.class, fecha)).isZero();
        assertThat(jdbc.queryForObject("""
                select count(*) from (select h.pedido_id from historial_estado_pedido h join pedido p on p.id = h.pedido_id
                where p.fecha_entrega = ? and h.estado_nuevo = 'ASIGNADO' group by 1 having count(*) <> 1) t""",
                Integer.class, fecha)).as("pedidos asignados mas de una vez").isZero();
        // el ultimo momento llena rutas con espacio antes de abrir otra: en el peor orden 1 + 3 (ultimo momento) + 3 (armado)
        assertThat(jdbc.queryForObject("select count(*) from ruta where fecha = ?", Integer.class, fecha))
                .isLessThanOrEqualTo(7);
    }

    private List<Throwable> ejecutarEnParalelo(List<Callable<Object>> tareas, List<Object> resultados) throws Exception {
        ExecutorService ejecutor = Executors.newFixedThreadPool(tareas.size());
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Object>> futuros = new ArrayList<>();
        for (Callable<Object> tarea : tareas) {
            futuros.add(ejecutor.submit(() -> {
                salida.await();
                return tarea.call();
            }));
        }
        salida.countDown();
        List<Throwable> errores = new ArrayList<>();
        for (Future<Object> futuro : futuros) {
            try {
                resultados.add(futuro.get(60, TimeUnit.SECONDS));
            } catch (Exception e) {
                errores.add(e.getCause() != null ? e.getCause() : e);
            }
        }
        ejecutor.shutdownNow();
        return errores;
    }
}
