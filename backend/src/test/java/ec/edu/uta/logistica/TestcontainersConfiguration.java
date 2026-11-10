package ec.edu.uta.logistica;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * PostgreSQL con PostGIS para las pruebas de integracion. La imagen postgis/postgis se declara
 * compatible con "postgres" para que Testcontainers la acepte.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    public static final String IMAGEN_POSTGIS = "postgis/postgis:16-3.4";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse(IMAGEN_POSTGIS).asCompatibleSubstituteFor("postgres"));
    }
}
