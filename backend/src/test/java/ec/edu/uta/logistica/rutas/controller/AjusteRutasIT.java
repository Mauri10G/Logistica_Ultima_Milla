package ec.edu.uta.logistica.rutas.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
import ec.edu.uta.logistica.IntegracionConSeguridadBase;
import ec.edu.uta.logistica.common.exception.ApiException;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;
import ec.edu.uta.logistica.pedidos.repository.ClienteRepository;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.rutas.service.AjusteRutasService;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Ajustes manuales de rutas por HTTP contra PostGIS, con la seguridad encendida. Usa fechas propias (hoy + 70 ... + 79).
 */
class AjusteRutasIT extends IntegracionConSeguridadBase {

    @Autowired
    private Clock reloj;
    @Autowired
    private PedidoRepository pedidoRepository;
    @Autowired
    private ClienteRepository clienteRepository;
    @Autowired
    private ZonaRepository zonaRepository;
    @Autowired
    private AjusteRutasService ajusteRutasService;
    @Autowired
    private JdbcTemplate jdbc;

    private List<Long> crearPedidos(LocalDate fecha, String zona, int cantidad) {
        Zona z = zonaRepository.findByNombreIgnoreCase(zona).orElseThrow();
        double lat = "Centro".equals(zona) ? -1.2440 : -1.2100;
        double lng = "Centro".equals(zona) ? -78.6200 : -78.6050;
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < cantidad; i++) {
            Cliente cliente = clienteRepository.save(new Cliente("Cliente ajuste " + i, "0990000000", null));
            ids.add(pedidoRepository.save(new Pedido(cliente, "Direccion ajuste " + i,
                    GeoUtil.punto(lat + i * 0.0003, lng + i * 0.0002), z, fecha, LocalTime.of(9, 0).plusMinutes(i),
                    LocalDateTime.now(reloj), PrioridadPedido.NORMAL, true)).getId());
        }
        return ids;
    }

    /** Arma las rutas de la fecha por HTTP y devuelve el cuerpo JSON. */
    private String armar(String token, LocalDate fecha) throws Exception {
        return mvc.perform(post("/api/rutas/armar").param("fecha", fecha.toString()).with(bearer(token)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private static long id(String json, String ruta) {
        return ((Number) JsonPath.read(json, ruta)).longValue();
    }

    private ResultActions mover(String token, long rutaId, long pedidoId) throws Exception {
        return mvc.perform(post("/api/rutas/" + rutaId + "/pedidos/" + pedidoId).with(bearer(token)));
    }

    private ResultActions reordenar(String token, long rutaId, String pedidos) throws Exception {
        return mvc.perform(put("/api/rutas/" + rutaId + "/orden").with(bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content("{\"pedidos\": " + pedidos + "}"));
    }

    @Test
    @DisplayName("ordenar, sacar, mover y cambiar repartidor por HTTP, sin superar nunca el maximo de 4")
    void flujoDeAjustes() throws Exception {
        String staff = tokenStaff();
        LocalDate fecha = LocalDate.now(reloj).plusDays(70);
        crearPedidos(fecha, "Centro", 5);
        String rutas = armar(staff, fecha); // 5 pedidos de Centro -> una ruta de 4 y otra de 1
        long llena = ((Number) ((List<?>) JsonPath.read(rutas, "$[?(@.pedidos.length() == 4)].id")).get(0)).longValue();
        long corta = ((Number) ((List<?>) JsonPath.read(rutas, "$[?(@.pedidos.length() == 1)].id")).get(0)).longValue();
        List<Number> idsLlena = JsonPath.read(rutas, "$[?(@.id == " + llena + ")].pedidos[*].id");
        long suelto = ((Number) ((List<?>) JsonPath.read(rutas, "$[?(@.id == " + corta + ")].pedidos[0].id"))
                .get(0)).longValue();

        // PUT orden: invierte las paradas de la ruta llena
        List<Long> invertido = new ArrayList<>(idsLlena.stream().map(Number::longValue).toList());
        Collections.reverse(invertido);
        reordenar(staff, llena, invertido.toString()).andExpect(status().isOk())
                .andExpect(jsonPath("$.pedidos[0].id").value(invertido.get(0)))
                .andExpect(jsonPath("$.pedidos[0].ordenEnRuta").value(1))
                .andExpect(jsonPath("$.pedidos[3].ordenEnRuta").value(4));
        reordenar(staff, llena, "[" + invertido.get(0) + "]").andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("ORDEN_INVALIDO"));
        reordenar(staff, llena, "[]").andExpect(status().isBadRequest());

        // POST mover a una ruta llena: 409 y nada cambia (CP-09)
        mover(staff, llena, suelto).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("RUTA_LLENA"));
        mvc.perform(get("/api/rutas/" + corta).with(bearer(staff))).andExpect(jsonPath("$.pedidos", hasSize(1)));

        // DELETE: sale uno de la llena y vuelve a PENDIENTE sin ruta
        long sacado = invertido.get(1);
        mvc.perform(delete("/api/rutas/" + llena + "/pedidos/" + sacado).with(bearer(staff)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pedidos", hasSize(3)))
                .andExpect(jsonPath("$.pedidos[2].ordenEnRuta").value(3));
        mvc.perform(get("/api/pedidos/" + sacado).with(bearer(staff)))
                .andExpect(jsonPath("$.estado").value("PENDIENTE")).andExpect(jsonPath("$.rutaId").doesNotExist());

        // ahora si cabe: el pedido de la ruta corta pasa a la llena, y el PENDIENTE a la corta
        mover(staff, llena, suelto).andExpect(status().isOk()).andExpect(jsonPath("$.pedidos", hasSize(4)))
                .andExpect(jsonPath("$.pedidos[3].id").value(suelto));
        mover(staff, corta, sacado).andExpect(status().isOk()).andExpect(jsonPath("$.pedidos", hasSize(1)));
        mover(staff, corta, sacado).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PEDIDO_YA_EN_RUTA"));

        // PATCH repartidor
        mvc.perform(patch("/api/rutas/" + corta + "/repartidor").with(bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"repartidorId\": 6}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.repartidorId").value(6));
        mvc.perform(patch("/api/rutas/" + corta + "/repartidor").with(bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"repartidorId\": 999999}"))
                .andExpect(status().isNotFound());

        // el historial del pedido sacado y vuelto a meter: ASIGNADO, PENDIENTE, ASIGNADO
        mvc.perform(get("/api/seguimiento/pedidos/" + sacado + "/historial").with(bearer(staff)))
                .andExpect(jsonPath("$", hasSize(3))).andExpect(jsonPath("$[1].estadoNuevo").value("PENDIENTE"))
                .andExpect(jsonPath("$[2].estadoNuevo").value("ASIGNADO"));
        verificarInvariantes(fecha);
    }

    @Test
    @DisplayName("un COURIER no puede hacer ajustes manuales (403) y una ruta EN_CURSO no se ajusta (409)")
    void permisosYEstado() throws Exception {
        String staff = tokenStaff();
        LocalDate fecha = LocalDate.now(reloj).plusDays(71);
        List<Long> ids = crearPedidos(fecha, "Centro", 2);
        String rutas = armar(staff, fecha);
        long rutaId = id(rutas, "$[0].id");
        long repartidorId = id(rutas, "$[0].repartidorId");
        String courier = tokensPorRepartidor().get(repartidorId);

        mover(courier, rutaId, ids.get(0)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/rutas/" + rutaId + "/pedidos/" + ids.get(0)).with(bearer(courier)))
                .andExpect(status().isForbidden());
        reordenar(courier, rutaId, ids.toString()).andExpect(status().isForbidden());
        mvc.perform(patch("/api/rutas/" + rutaId + "/repartidor").with(bearer(courier))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"repartidorId\": 1}"))
                .andExpect(status().isForbidden());

        // el repartidor recoge el primer pedido: la ruta pasa a EN_CURSO y ya no admite ajustes
        mvc.perform(patch("/api/pedidos/" + ids.get(0) + "/estado").with(bearer(courier))
                .contentType(MediaType.APPLICATION_JSON).content("{\"estado\": \"RECOGIDO\"}")).andExpect(status().isOk());
        mvc.perform(delete("/api/rutas/" + rutaId + "/pedidos/" + ids.get(1)).with(bearer(staff)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("RUTA_NO_MODIFICABLE"));
        reordenar(staff, rutaId, List.of(ids.get(1), ids.get(0)).toString()).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("concurrencia: 10 pedidos se mueven a la vez a una ruta con 1: entran 3 y la ruta queda en 4")
    void movimientosSimultaneosNoSuperanElMaximo() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(72);
        crearPedidos(fecha, "Centro", 1);
        long rutaId = id(armar(tokenStaff(), fecha), "$[0].id");
        List<Long> candidatos = crearPedidos(fecha, "Norte/Izamba", 10); // otra zona: se bloquean ambas en orden

        List<Callable<Object>> tareas = new ArrayList<>();
        for (Long pedidoId : candidatos) {
            tareas.add(() -> ajusteRutasService.agregarPedido(rutaId, pedidoId));
        }
        List<Throwable> errores = ejecutarEnParalelo(tareas);

        assertThat(errores).hasSize(7).allSatisfy(e -> assertThat(e).isInstanceOf(ApiException.class)
                .extracting(x -> ((ApiException) x).getCodigo()).isEqualTo("RUTA_LLENA"));
        assertThat(jdbc.queryForObject("select count(*) from pedido where ruta_id = ?", Integer.class, rutaId))
                .isEqualTo(4);
        verificarInvariantes(fecha);
    }

    @Test
    @DisplayName("concurrencia: ajustes y armado de la misma fecha a la vez dejan cada pedido en una sola ruta")
    void ajustesMientrasSeArma() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(73);
        crearPedidos(fecha, "Centro", 2);
        long rutaId = id(armar(tokenStaff(), fecha), "$[0].id");
        List<Long> nuevos = crearPedidos(fecha, "Centro", 8);

        List<Callable<Object>> tareas = new ArrayList<>();
        tareas.add(() -> mvc.perform(post("/api/rutas/armar").param("fecha", fecha.toString())
                .with(bearer(tokenStaff()))).andReturn());
        for (Long pedidoId : nuevos) {
            tareas.add(() -> {
                try {
                    return ajusteRutasService.agregarPedido(rutaId, pedidoId);
                } catch (ApiException esperado) {
                    return esperado; // RUTA_LLENA o el armado ya lo asigno a la misma ruta: resultados validos
                }
            });
        }
        assertThat(ejecutarEnParalelo(tareas)).as("errores inesperados").isEmpty();

        verificarInvariantes(fecha);
        assertThat(jdbc.queryForObject("select count(*) from pedido where fecha_entrega = ? and ruta_id is null",
                Integer.class, fecha)).as("pedidos sin ruta despues del armado").isZero();
    }

    private List<Throwable> ejecutarEnParalelo(List<Callable<Object>> tareas) throws Exception {
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
                futuro.get(60, TimeUnit.SECONDS);
            } catch (Exception e) {
                errores.add(e.getCause() != null ? e.getCause() : e);
            }
        }
        ejecutor.shutdownNow();
        return errores;
    }

    /** Ninguna ruta supera su maximo, ninguna posicion se repite y cada pedido con ruta esta ASIGNADO o mas. */
    private void verificarInvariantes(LocalDate fecha) {
        assertThat(jdbc.queryForList("""
                select r.id from ruta r join pedido p on p.ruta_id = r.id where r.fecha = ?
                group by r.id, r.max_pedidos having count(*) > r.max_pedidos""", Long.class, fecha))
                .as("rutas por encima del maximo").isEmpty();
        assertThat(jdbc.queryForObject("""
                select count(*) from (select ruta_id, orden_en_ruta from pedido where fecha_entrega = ?
                and ruta_id is not null group by 1, 2 having count(*) > 1) t""", Integer.class, fecha)).isZero();
        assertThat(jdbc.queryForObject("""
                select count(*) from pedido where fecha_entrega = ?
                and ((ruta_id is null) <> (estado = 'PENDIENTE'))""", Integer.class, fecha))
                .as("pedidos con ruta y PENDIENTE, o sin ruta y asignados").isZero();
        // las posiciones de cada ruta son 1..n sin huecos
        assertThat(jdbc.queryForObject("""
                select count(*) from (select ruta_id, max(orden_en_ruta) m, count(*) c from pedido
                where fecha_entrega = ? and ruta_id is not null group by ruta_id) t where m <> c""",
                Integer.class, fecha)).isZero();
    }
}
