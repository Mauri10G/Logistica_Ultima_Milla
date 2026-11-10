package ec.edu.uta.logistica;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * Base de todas las pruebas de integracion (*IT). Al compartir exactamente la misma configuracion, Spring reutiliza
 * un solo contexto y por lo tanto un solo contenedor PostGIS para toda la ejecucion.
 *
 * <p>La base de datos se comparte entre clases y NO se reinicia: cada prueba debe usar sus propias fechas
 * (los datos base de Flyway dejan 20 pedidos para "manana"; no los toque).
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
public abstract class IntegrationTestBase {
}
