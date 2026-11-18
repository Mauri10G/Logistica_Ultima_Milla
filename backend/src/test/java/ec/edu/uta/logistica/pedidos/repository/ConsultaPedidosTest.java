package ec.edu.uta.logistica.pedidos.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ConsultaPedidosTest {

    @ParameterizedTest(name = "\"{0}\" se normaliza a \"{1}\"")
    @CsvSource({"Bolívar, bolivar", "NUÑEZ, nunez", "  Mera y Sucre  , mera y sucre", "José Ñ, jose n",
            "Ambato, ambato"})
    @DisplayName("normalizar pasa a minusculas y quita tildes, dieresis y virgulillas")
    void normaliza(String entrada, String esperado) {
        assertThat(ConsultaPedidos.normalizar(entrada)).isEqualTo(esperado);
    }

    @Test
    @DisplayName("escaparLike escapa los comodines % y _ y la barra invertida para buscarlos como texto literal")
    void escapaComodines() {
        assertThat(ConsultaPedidos.escaparLike("100%_ok\\")).isEqualTo("100\\%\\_ok\\\\");
        assertThat(ConsultaPedidos.escaparLike("sin comodines")).isEqualTo("sin comodines");
    }

    @Test
    @DisplayName("las letras con tilde y sus equivalentes tienen la misma longitud (translate de PostgreSQL)")
    void tablasDeTraduccionConsistentes() throws Exception {
        var conTilde = ConsultaPedidos.class.getDeclaredField("CON_TILDE");
        var sinTilde = ConsultaPedidos.class.getDeclaredField("SIN_TILDE");
        conTilde.setAccessible(true);
        sinTilde.setAccessible(true);

        assertThat(((String) conTilde.get(null)).length()).isEqualTo(((String) sinTilde.get(null)).length());
    }

    @Test
    @DisplayName("las columnas ordenables son las siete de la tabla de pedidos")
    void columnasOrdenables() {
        assertThat(ConsultaPedidos.COLUMNAS_ORDENABLES).containsExactly("id", "cliente", "direccion", "zona",
                "fechaEntrega", "fechaRegistro", "estado");
    }
}
