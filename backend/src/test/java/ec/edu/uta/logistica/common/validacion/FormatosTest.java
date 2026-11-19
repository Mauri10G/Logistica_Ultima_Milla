package ec.edu.uta.logistica.common.validacion;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

import ec.edu.uta.logistica.pedidos.dto.PedidoRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorAltaRequest;
import ec.edu.uta.logistica.repartidores.dto.RepartidorRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Issue #32: formato de telefono y nombre en clientes y repartidores, con el validador real de Bean Validation. */
class FormatosTest {

    private static ValidatorFactory fabrica;
    private static Validator validador;

    @BeforeAll
    static void crearValidador() {
        fabrica = Validation.buildDefaultValidatorFactory();
        validador = fabrica.getValidator();
    }

    @AfterAll
    static void cerrar() {
        fabrica.close();
    }

    private static PedidoRequest pedido(String nombres, String telefono) {
        return new PedidoRequest(null, nombres, telefono, null, "Bolivar y Mera", -1.2412, -78.6197,
                LocalDate.of(2027, 2, 14), LocalTime.of(10, 0), null, null);
    }

    private static Set<String> camposConError(Object solicitud) {
        Set<ConstraintViolation<Object>> errores = validador.validate(solicitud);
        return errores.stream().map(e -> e.getPropertyPath().toString()).collect(java.util.stream.Collectors.toSet());
    }

    @ParameterizedTest(name = "\"{0}\" es valido")
    @ValueSource(strings = {"0991234567", "032821234", "+593 99 123 4567", "03-282-1234", "1234567", "123456789012345"})
    @DisplayName("telefonos validos: 7 a 15 digitos con espacios, guiones o + inicial")
    void telefonosValidos(String telefono) {
        assertThat(camposConError(pedido("Maria Torres", telefono))).isEmpty();
        assertThat(camposConError(new RepartidorRequest("Ana Ruiz", telefono, null, null))).isEmpty();
    }

    @ParameterizedTest(name = "\"{0}\" se rechaza")
    @ValueSource(strings = {"abc", "099abc4567", "123456", "1234567890123456", "+", "099 123 456 -", "-0991234567",
            "09912+34567", "0991234567 ext 2"})
    @DisplayName("telefonos invalidos: letras, menos de 7 o mas de 15 digitos, simbolos fuera de lugar")
    void telefonosInvalidos(String telefono) {
        assertThat(camposConError(pedido("Maria Torres", telefono))).containsExactly("clienteTelefono");
        assertThat(camposConError(new RepartidorRequest("Ana Ruiz", telefono, null, null))).containsExactly("telefono");
        assertThat(camposConError(new RepartidorAltaRequest("Ana Ruiz", telefono, null, null, "ana", "clave123")))
                .containsExactly("telefono");
    }

    @ParameterizedTest(name = "\"{0}\" es valido")
    @ValueSource(strings = {"Maria Torres", "Ángela Núñez", "José Peña 2", "O'Brien", "Ana-María"})
    @DisplayName("nombres validos: con al menos una letra (tildes y enie incluidas)")
    void nombresValidos(String nombres) {
        assertThat(camposConError(pedido(nombres, "0991234567"))).isEmpty();
        assertThat(camposConError(new RepartidorRequest(nombres, "0991234567", null, null))).isEmpty();
    }

    @ParameterizedTest(name = "\"{0}\" se rechaza")
    @ValueSource(strings = {"12345", "---", "123 456", "..."})
    @DisplayName("nombres sin ninguna letra se rechazan")
    void nombresInvalidos(String nombres) {
        assertThat(camposConError(pedido(nombres, "0991234567"))).containsExactly("clienteNombres");
        assertThat(camposConError(new RepartidorRequest(nombres, "0991234567", null, null))).containsExactly("nombres");
    }

    @Test
    @DisplayName("con clienteId el pedido puede venir sin nombre ni telefono (son opcionales)")
    void clienteExistenteSinDatos() {
        assertThat(camposConError(pedido(null, null))).isEmpty();
    }
}
