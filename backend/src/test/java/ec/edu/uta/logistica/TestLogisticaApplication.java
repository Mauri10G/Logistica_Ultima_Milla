package ec.edu.uta.logistica;

import org.springframework.boot.SpringApplication;

/**
 * Levanta la aplicacion con un PostGIS efimero de Testcontainers (sin docker compose):
 * {@code ./mvnw spring-boot:test-run}
 */
public class TestLogisticaApplication {

    public static void main(String[] args) {
        SpringApplication.from(LogisticaApplication::main).with(TestcontainersConfiguration.class).run(args);
    }
}
