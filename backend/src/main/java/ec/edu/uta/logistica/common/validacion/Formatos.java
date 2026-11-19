package ec.edu.uta.logistica.common.validacion;

/**
 * Formatos de texto que se validan con {@code @Pattern} en los DTO. Un solo lugar para el cliente y el repartidor.
 */
public final class Formatos {

    /**
     * Telefono: solo digitos, espacios, guiones y un {@code +} inicial, empezando y terminando en digito, con 7 a 15
     * digitos en total (por ejemplo {@code 0991234567}, {@code +593 99 123 4567}, {@code 03-282-1234}).
     */
    public static final String TELEFONO = "^(?=(?:\\D*\\d){7,15}\\D*$)\\+?\\d[\\d -]*\\d$";
    public static final String MENSAJE_TELEFONO =
            "El telefono solo admite digitos, espacios, guiones y un + inicial, con 7 a 15 digitos";

    /** Nombre de persona: al menos una letra (rechaza "12345" o "---"); admite tildes y enie. */
    public static final String NOMBRE = "^(?=.*\\p{L}).+$";
    public static final String MENSAJE_NOMBRE = "El nombre debe contener al menos una letra";

    private Formatos() {
    }
}
