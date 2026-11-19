package ec.edu.uta.logistica.rutas.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.jayway.jsonpath.JsonPath;
import ec.edu.uta.logistica.IntegrationTestBase;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Issue #31: {@code GET /api/rutas?fecha=} con el volumen de San Valentin (~5 100 pedidos en ~1 275 rutas, cada pedido
 * con su propio cliente). El listado debe resolverse con un numero fijo de consultas SQL, sin N+1 por ruta, pedido o
 * cliente. Usa la fecha hoy + 90.
 */
class ListadoRutasVolumenIT extends IntegrationTestBase {

    private static final Logger LOG = LoggerFactory.getLogger(ListadoRutasVolumenIT.class);
    private static final int RUTAS = 1_275;
    private static final int PEDIDOS = RUTAS * 4;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private EntityManagerFactory emf;
    @Autowired
    private Clock reloj;

    private void poblar(LocalDate fecha) {
        jdbc.update("""
                insert into ruta (fecha, zona_id, repartidor_id, estado, max_pedidos)
                select ?, z.id, r.id, 'ARMADA', 4
                from generate_series(1, ?) g
                join (select id, row_number() over (order by id) - 1 as n from repartidor) r on r.n = g % 6
                cross join (select id from zona where nombre = 'Centro') z
                """, fecha, RUTAS);
        jdbc.update("""
                with c as (
                    insert into cliente (nombres, telefono)
                    select 'Cliente volumen ' || g, '0990000000' from generate_series(1, ?) g
                    returning id),
                cn as (select id, row_number() over (order by id) as n from c),
                rn as (select id, row_number() over (order by id) as n from ruta where fecha = ?)
                insert into pedido (cliente_id, direccion, ubicacion, zona_id, fecha_entrega, hora_entrega,
                                    fecha_registro, prioridad, estado, registrado_por_personal, ruta_id, orden_en_ruta)
                select cn.id, 'Direccion volumen ' || cn.n,
                       ST_SetSRID(ST_MakePoint(-78.62 + (cn.n % 100) * 0.0001, -1.244 + (cn.n / 100) * 0.00001), 4326),
                       z.id, ?, time '10:00', now(), 'NORMAL', 'ASIGNADO', true, rn.id, ((cn.n - 1) % 4) + 1
                from cn
                join rn on rn.n = ((cn.n - 1) / 4) + 1
                cross join (select id from zona where nombre = 'Centro') z
                """, PEDIDOS, fecha, fecha);
    }

    @Test
    @DisplayName("listar 1 275 rutas con 5 100 pedidos usa un numero fijo de consultas y responde todo en orden")
    void listadoSinNMasUno() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(90);
        poblar(fecha);
        Statistics estadisticas = emf.unwrap(SessionFactory.class).getStatistics();
        mvc.perform(get("/api/rutas").param("fecha", fecha.toString())).andExpect(status().isOk()); // calentamiento

        estadisticas.setStatisticsEnabled(true);
        estadisticas.clear();
        long inicio = System.nanoTime();
        String json = mvc.perform(get("/api/rutas").param("fecha", fecha.toString()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long milisegundos = (System.nanoTime() - inicio) / 1_000_000;
        long consultas = estadisticas.getPrepareStatementCount();
        estadisticas.setStatisticsEnabled(false);
        LOG.info("GET /api/rutas con {} rutas y {} pedidos: {} ms, {} consultas SQL, {} KB", RUTAS, PEDIDOS,
                milisegundos, consultas, json.length() / 1024);

        List<Integer> tamanos = JsonPath.read(json, "$[*].pedidos.length()");
        assertThat(tamanos).hasSize(RUTAS).containsOnly(4);
        assertThat(JsonPath.<List<Integer>>read(json, "$[0].pedidos[*].ordenEnRuta")).containsExactly(1, 2, 3, 4);
        assertThat(JsonPath.<List<String>>read(json, "$[0].pedidos[*].clienteNombres")).allMatch(n -> !n.isBlank());
        assertThat(consultas).as("consultas SQL para listar las rutas de un dia (sin N+1)").isLessThanOrEqualTo(3);
    }
}
