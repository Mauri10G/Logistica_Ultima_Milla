package ec.edu.uta.logistica.zonas.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import ec.edu.uta.logistica.IntegrationTestBase;
import ec.edu.uta.logistica.testutil.Fabrica;
import ec.edu.uta.logistica.zonas.entity.Zona;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Las dos consultas espaciales de las que dependen CP-03 (ST_Contains) y CP-06 a CP-08 (ST_Intersects). */
class ZonaRepositoryIT extends IntegrationTestBase {

    @Autowired
    private ZonaRepository zonaRepository;

    @Test
    @DisplayName("CP-03: ST_Contains encuentra la zona de un punto dentro de ella")
    void puntoDentroDeUnaZona() {
        assertThat(zonaRepository.buscarZonaQueContiene(-1.2412, -78.6197)).get()
                .extracting(Zona::getNombre).isEqualTo("Centro");
        assertThat(zonaRepository.buscarZonaQueContiene(-1.2100, -78.6050)).get()
                .extracting(Zona::getNombre).isEqualTo("Norte/Izamba");
    }

    @Test
    @DisplayName("CP-03: un punto fuera de toda zona (o en el margen entre zonas) no tiene zona")
    void puntoFueraDeToda() {
        assertThat(zonaRepository.buscarZonaQueContiene(-1.3000, -78.5000)).isEmpty();
        assertThat(zonaRepository.buscarZonaQueContiene(-1.2350, -78.6170)).isEmpty(); // margen Centro/Ingahurco
    }

    @Test
    @DisplayName("CP-06: ST_Intersects lista las zonas con las que se superpone un poligono")
    void detectaSuperposicion() {
        // cubre parte de Centro (lat < -1.2360) e Ingahurco (lat > -1.2340)
        String wkt = Fabrica.rectangulo(-78.6200, -1.2400, -78.6150, -1.2300).toText();

        List<Zona> superpuestas = zonaRepository.buscarSuperpuestas(wkt, 0L);

        assertThat(superpuestas).extracting(Zona::getNombre).containsExactly("Centro", "Ingahurco");
    }

    @Test
    @DisplayName("un poligono alejado de las zonas no se superpone con ninguna")
    void sinSuperposicion() {
        String wkt = Fabrica.rectangulo(-78.50, -1.40, -78.49, -1.39).toText();

        assertThat(zonaRepository.buscarSuperpuestas(wkt, 0L)).isEmpty();
    }

    @Test
    @DisplayName("CP-08: al editar se excluye la propia zona de la comparacion")
    void excluyeLaPropiaZona() {
        Zona centro = zonaRepository.findByNombreIgnoreCase("Centro").orElseThrow();

        assertThat(zonaRepository.buscarSuperpuestas(centro.getArea().toText(), 0L)).extracting(Zona::getNombre)
                .containsExactly("Centro");
        assertThat(zonaRepository.buscarSuperpuestas(centro.getArea().toText(), centro.getId())).isEmpty();
    }

    @Test
    @DisplayName("las 5 zonas de los datos base no se superponen entre si")
    void zonasBaseSinSuperposicion() {
        for (Zona zona : zonaRepository.findByActivaTrueOrderByNombre()) {
            assertThat(zonaRepository.buscarSuperpuestas(zona.getArea().toText(), zona.getId()))
                    .as("zonas que se superponen con %s", zona.getNombre()).isEmpty();
        }
    }
}
