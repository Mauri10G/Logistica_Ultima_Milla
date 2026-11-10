package ec.edu.uta.logistica;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

class LogisticaApplicationIT extends IntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("el contexto levanta y Flyway aplico V1 y V2 sobre PostGIS")
    void contextoYMigraciones() {
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success", Integer.class))
                .isGreaterThanOrEqualTo(2);
        assertThat(jdbc.queryForObject("select postgis_version()", String.class)).isNotBlank();
        // Solo las zonas de V2: la base se comparte con otras *IT, que pueden crear zonas antes que esta prueba
        // (el orden de ejecucion cambia entre equipos y CI), asi que no se cuenta la tabla completa.
        assertThat(jdbc.queryForObject("select count(*) from zona where nombre in "
                + "('Centro', 'Ingahurco', 'Ficoa/Atocha', 'Norte/Izamba', 'Sur/Huachi')", Integer.class))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("los indices espaciales y el compuesto existen")
    void indices() {
        assertThat(jdbc.queryForList("select indexname from pg_indexes where tablename in ('zona','pedido')",
                String.class))
                .contains("idx_zona_area_gist", "idx_pedido_ubicacion_gist", "idx_pedido_fecha_zona_estado");
    }

    @Test
    @DisplayName("/actuator/health responde UP")
    void health() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Swagger/OpenAPI documenta los endpoints")
    void openApi() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/pedidos']").exists())
                .andExpect(jsonPath("$.paths['/api/rutas/armar']").exists());
    }
}
