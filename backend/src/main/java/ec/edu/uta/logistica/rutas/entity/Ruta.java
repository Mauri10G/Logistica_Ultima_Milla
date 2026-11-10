package ec.edu.uta.logistica.rutas.entity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

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
