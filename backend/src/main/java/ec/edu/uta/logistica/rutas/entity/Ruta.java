package ec.edu.uta.logistica.rutas.entity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.exception.ReglaNegocioException;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.repartidores.entity.Repartidor;
import ec.edu.uta.logistica.zonas.entity.Zona;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "ruta")
public class Ruta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate fecha;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "zona_id", nullable = false)
    private Zona zona;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repartidor_id", nullable = false)
    private Repartidor repartidor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoRuta estado = EstadoRuta.ARMADA;

    @Column(name = "max_pedidos", nullable = false)
    private int maxPedidos;

    @Version
    private Long version;

    @OneToMany(mappedBy = "ruta")
    @OrderBy("ordenEnRuta ASC")
    private List<Pedido> pedidos = new ArrayList<>();

    protected Ruta() {
        // requerido por JPA
    }

    public Ruta(LocalDate fecha, Zona zona, Repartidor repartidor, int maxPedidos) {
        if (maxPedidos < 1) {
            throw new IllegalArgumentException("El maximo de pedidos por ruta debe ser al menos 1");
        }
        this.fecha = fecha;
        this.zona = zona;
        this.repartidor = repartidor;
        this.maxPedidos = maxPedidos;
    }

    /**
     * Agrega un pedido al final de la ruta. CP-09: lanza {@link IllegalStateException} si se supera el maximo.
     */
    public void agregarPedido(Pedido pedido) {
        if (!tieneEspacio()) {
            throw new IllegalStateException("La ruta ya tiene el maximo de " + maxPedidos + " pedidos");
        }
        if (!fecha.equals(pedido.getFechaEntrega())) {
            throw new IllegalArgumentException("El pedido tiene otra fecha de entrega que la ruta");
        }
        pedido.asignarARuta(this, pedidos.size() + 1); // valida PENDIENTE -> ASIGNADO
        pedidos.add(pedido);
    }

    /** Los ajustes manuales solo se permiten antes de que el repartidor salga (ruta ARMADA). */
    public void exigirModificable() {
        if (estado != EstadoRuta.ARMADA) {
            throw new ConflictoException("RUTA_NO_MODIFICABLE",
                    "Solo se puede ajustar una ruta ARMADA (estado actual: " + estado + ")");
        }
    }

    public boolean contiene(Pedido pedido) {
        return pedidos.stream().anyMatch(p -> p.getId().equals(pedido.getId()));
    }

    /** Saca un pedido (vuelve a PENDIENTE) y renumera las paradas que quedan: 1, 2, 3... */
    public void quitarPedido(Pedido pedido) {
        exigirModificable();
        Pedido enRuta = pedidos.stream().filter(p -> p.getId().equals(pedido.getId())).findFirst()
                .orElseThrow(() -> new ConflictoException("PEDIDO_NO_ESTA_EN_RUTA",
                        "El pedido " + pedido.getId() + " no esta en la ruta " + id));
        enRuta.desasignarDeRuta();
        pedidos.remove(enRuta);
        renumerar();
    }

    /**
     * Cambia el orden de visita. {@code idsEnOrden} debe tener exactamente los mismos pedidos que la ruta, sin
     * repetir ni agregar ninguno.
     */
    public void reordenar(List<Long> idsEnOrden) {
        exigirModificable();
        Set<Long> actuales = pedidos.stream().map(Pedido::getId).collect(Collectors.toSet());
        if (idsEnOrden.size() != pedidos.size() || !actuales.equals(new HashSet<>(idsEnOrden))) {
            throw new ReglaNegocioException("ORDEN_INVALIDO", "El nuevo orden debe incluir exactamente los pedidos "
                    + "de la ruta, sin repetir ni agregar: " + actuales.stream().sorted().toList());
        }
        Map<Long, Pedido> porId = pedidos.stream().collect(Collectors.toMap(Pedido::getId, p -> p));
        pedidos.clear();
        idsEnOrden.forEach(pedidoId -> pedidos.add(porId.get(pedidoId)));
        renumerar();
    }

    public void asignarRepartidor(Repartidor nuevo) {
        exigirModificable();
        this.repartidor = nuevo;
    }

    private void renumerar() {
        for (int i = 0; i < pedidos.size(); i++) {
            pedidos.get(i).cambiarOrdenEnRuta(i + 1);
        }
    }

    public boolean tieneEspacio() {
        return pedidos.size() < maxPedidos;
    }

    public boolean todosEntregados() {
        return !pedidos.isEmpty() && pedidos.stream().allMatch(p -> p.getEstado() == EstadoPedido.ENTREGADO);
    }

    public void iniciar() {
        if (estado == EstadoRuta.ARMADA) {
            estado = EstadoRuta.EN_CURSO;
        }
    }

    public void finalizar() {
        estado = EstadoRuta.FINALIZADA;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getFecha() {
        return fecha;
    }

    public Zona getZona() {
        return zona;
    }

    public Repartidor getRepartidor() {
        return repartidor;
    }

    public EstadoRuta getEstado() {
        return estado;
    }

    public int getMaxPedidos() {
        return maxPedidos;
    }

    public Long getVersion() {
        return version;
    }

    /** Vista de solo lectura: toda alta pasa por {@link #agregarPedido(Pedido)}. */
    public List<Pedido> getPedidos() {
        return Collections.unmodifiableList(pedidos);
    }
}
