package ec.edu.uta.logistica.pedidos.repository;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * Filtros, busqueda por texto y orden de {@code GET /api/pedidos}. El orden usa nombres logicos de columna
 * ({@link #COLUMNAS_ORDENABLES}), no atributos de la entidad: asi la API no expone el modelo interno.
 */
public final class ConsultaPedidos {

    /** Columnas por las que se puede ordenar (parametro {@code sort}); cualquier otra se rechaza con 400. */
    public static final List<String> COLUMNAS_ORDENABLES =
            List.of("id", "cliente", "direccion", "zona", "fechaEntrega", "fechaRegistro", "estado");

    /** Orden cuando el cliente no pide ninguno: entrega (fecha y hora) y luego id. */
    public static final Sort ORDEN_POR_DEFECTO = Sort.by("fechaEntrega", "id");

    // Letras con tilde (o ñ, ç) y su equivalente sin ella, para translate() en PostgreSQL. Misma longitud en ambas.
    private static final String CON_TILDE = "áàâäãéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ";
    private static final String SIN_TILDE = "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC";
    private static final char ESCAPE = '\\';

    private ConsultaPedidos() {
    }

    /** Minusculas y sin tildes ni diacriticos: "Bolívar" y "NUÑEZ" quedan como "bolivar" y "nunez". */
    public static String normalizar(String texto) {
        String sinMarcas = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return sinMarcas.toLowerCase(Locale.ROOT);
    }

    /** Escapa % _ y \ para que el texto del usuario se busque tal cual en un LIKE. */
    static String escaparLike(String texto) {
        return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /**
     * Especificacion completa. Los parametros nulos (o texto en blanco) no filtran. El orden se aplica aqui y no con
     * el {@code Pageable} porque "estado" ordena por su lugar en el flujo y "fechaEntrega" por fecha y hora.
     */
    public static Specification<Pedido> especificacion(LocalDate fecha, Long zonaId, EstadoPedido estado,
                                                       String texto, Sort orden) {
        return (pedido, consulta, cb) -> {
            List<Predicate> condiciones = new ArrayList<>();
            if (fecha != null) {
                condiciones.add(cb.equal(pedido.get("fechaEntrega"), fecha));
            }
            if (zonaId != null) {
                condiciones.add(cb.equal(pedido.get("zona").get("id"), zonaId));
            }
            if (estado != null) {
                condiciones.add(cb.equal(pedido.get("estado"), estado));
            }
            if (texto != null && !texto.isBlank()) {
                String patron = "%" + escaparLike(normalizar(texto)) + "%";
                condiciones.add(cb.or(
                        cb.like(sinTildes(cb, pedido.get("cliente").get("nombres")), patron, ESCAPE),
                        cb.like(sinTildes(cb, pedido.get("direccion")), patron, ESCAPE)));
            }
            // La consulta de conteo (Long) no lleva ORDER BY.
            if (consulta != null && consulta.getResultType() != Long.class && consulta.getResultType() != long.class) {
                consulta.orderBy(ordenar(pedido, cb, orden));
            }
            return cb.and(condiciones.toArray(Predicate[]::new));
        };
    }

    /** lower(translate(columna, ...)): comparacion sin mayusculas ni tildes, sin depender de extensiones ni del locale. */
    private static Expression<String> sinTildes(CriteriaBuilder cb, Expression<String> columna) {
        Expression<String> traducida = cb.function("translate", String.class, columna,
                cb.literal(CON_TILDE), cb.literal(SIN_TILDE));
        return cb.lower(traducida);
    }

    private static List<Order> ordenar(Root<Pedido> pedido, CriteriaBuilder cb, Sort orden) {
        Sort efectivo = orden == null || orden.isUnsorted() ? ORDEN_POR_DEFECTO : orden;
        List<Order> resultado = new ArrayList<>();
        boolean traeId = false;
        for (Sort.Order pedida : efectivo) {
            boolean asc = pedida.isAscending();
            traeId |= "id".equals(pedida.getProperty());
            switch (pedida.getProperty()) {
                case "id" -> resultado.add(direccion(cb, pedido.get("id"), asc));
                case "cliente" -> resultado.add(direccion(cb, pedido.get("cliente").get("nombres"), asc));
                case "direccion" -> resultado.add(direccion(cb, pedido.get("direccion"), asc));
                case "zona" -> resultado.add(direccion(cb, pedido.get("zona").get("nombre"), asc));
                case "fechaEntrega" -> {
                    resultado.add(direccion(cb, pedido.get("fechaEntrega"), asc));
                    resultado.add(direccion(cb, pedido.get("horaEntrega"), asc));
                }
                case "fechaRegistro" -> resultado.add(direccion(cb, pedido.get("fechaRegistro"), asc));
                case "estado" -> resultado.add(direccion(cb, lugarEnElFlujo(pedido, cb), asc));
                default -> throw new IllegalArgumentException("Columna no ordenable: " + pedida.getProperty());
            }
        }
        if (!traeId) {
            resultado.add(cb.asc(pedido.get("id"))); // desempate: la paginacion necesita un orden total estable
        }
        return resultado;
    }

    /** PENDIENTE=0 ... ENTREGADO=4: el estado ordena por su lugar en el flujo, no por orden alfabetico. */
    private static Expression<Integer> lugarEnElFlujo(Root<Pedido> pedido, CriteriaBuilder cb) {
        CriteriaBuilder.SimpleCase<EstadoPedido, Integer> caso = cb.selectCase(pedido.<EstadoPedido>get("estado"));
        for (EstadoPedido estado : EstadoPedido.values()) {
            caso.when(estado, estado.ordinal());
        }
        return caso.otherwise(EstadoPedido.values().length);
    }

    private static Order direccion(CriteriaBuilder cb, Expression<?> expresion, boolean ascendente) {
        return ascendente ? cb.asc(expresion) : cb.desc(expresion);
    }
}
