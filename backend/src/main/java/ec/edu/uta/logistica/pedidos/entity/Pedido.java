package ec.edu.uta.logistica.pedidos.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.rutas.entity.Ruta;
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
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "pedido")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, length = 255)
    private String direccion;

    @Column(nullable = false, columnDefinition = "geometry(Point,4326)")
    private Point ubicacion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "zona_id", nullable = false)
    private Zona zona;

    @Column(name = "fecha_entrega", nullable = false)
    private LocalDate fechaEntrega;

    @Column(name = "hora_entrega", nullable = false)
    private LocalTime horaEntrega;

    /** Momento en que se registro el pedido (distinto de la fecha de entrega). */
    @Column(name = "fecha_registro", nullable = false, updatable = false)
    private LocalDateTime fechaRegistro;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PrioridadPedido prioridad = PrioridadPedido.NORMAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoPedido estado = EstadoPedido.PENDIENTE;

    @Column(name = "registrado_por_personal", nullable = false)
    private boolean registradoPorPersonal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id")
    private Ruta ruta;

    @Column(name = "orden_en_ruta")
    private Integer ordenEnRuta;

    /** Bloqueo optimista: dos escrituras concurrentes sobre el mismo pedido no se pisan. */
    @Version
    private Long version;

    protected Pedido() {
        // requerido por JPA
    }

    public Pedido(Cliente cliente, String direccion, Point ubicacion, Zona zona, LocalDate fechaEntrega,
                  LocalTime horaEntrega, LocalDateTime fechaRegistro, PrioridadPedido prioridad,
                  boolean registradoPorPersonal) {
        this.cliente = cliente;
        this.direccion = direccion;
        this.ubicacion = ubicacion;
        this.zona = zona;
        this.fechaEntrega = fechaEntrega;
        this.horaEntrega = horaEntrega;
        this.fechaRegistro = fechaRegistro;
        this.prioridad = prioridad != null ? prioridad : PrioridadPedido.NORMAL;
        this.registradoPorPersonal = registradoPorPersonal;
    }

    /** CP-05: solo se puede editar un pedido PENDIENTE. */
    public void exigirEditable() {
        if (estado != EstadoPedido.PENDIENTE) {
            throw new ConflictoException("PEDIDO_NO_EDITABLE",
                    "Solo se puede editar un pedido en estado PENDIENTE (estado actual: " + estado + ")");
        }
    }

    public void actualizarDatos(Cliente cliente, String direccion, Point ubicacion, Zona zona,
                                LocalDate fechaEntrega, LocalTime horaEntrega, PrioridadPedido prioridad) {
        exigirEditable();
        this.cliente = cliente;
        this.direccion = direccion;
        this.ubicacion = ubicacion;
        this.zona = zona;
        this.fechaEntrega = fechaEntrega;
        this.horaEntrega = horaEntrega;
        if (prioridad != null) {
            this.prioridad = prioridad;
        }
    }

    /** Cambia el estado validando la transicion. */
    public void cambiarEstado(EstadoPedido nuevo) {
        estado.validarTransicionA(nuevo);
        this.estado = nuevo;
    }

    /** Lo invoca {@code Ruta.agregarPedido}: PENDIENTE -> ASIGNADO. */
    public void asignarARuta(Ruta ruta, int orden) {
        cambiarEstado(EstadoPedido.ASIGNADO);
        this.ruta = ruta;
        this.ordenEnRuta = orden;
    }

    public Long getId() {
        return id;
    }

    public Cliente getCliente() {
        return cliente;
    }

    public String getDireccion() {
        return direccion;
    }

    public Point getUbicacion() {
        return ubicacion;
    }

    public Zona getZona() {
        return zona;
    }

    public LocalDate getFechaEntrega() {
        return fechaEntrega;
    }

    public LocalTime getHoraEntrega() {
        return horaEntrega;
    }

    public LocalDateTime getFechaRegistro() {
        return fechaRegistro;
    }

    public PrioridadPedido getPrioridad() {
        return prioridad;
    }

    public EstadoPedido getEstado() {
        return estado;
    }

    public boolean isRegistradoPorPersonal() {
        return registradoPorPersonal;
    }

    public Ruta getRuta() {
        return ruta;
    }

    public Integer getOrdenEnRuta() {
        return ordenEnRuta;
    }

    public Long getVersion() {
        return version;
    }
}
