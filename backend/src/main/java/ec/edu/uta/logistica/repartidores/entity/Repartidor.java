package ec.edu.uta.logistica.repartidores.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "repartidor")
public class Repartidor {

    public static final int CAPACIDAD_POR_DEFECTO = 4;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nombres;

    @Column(nullable = false, length = 30)
    private String telefono;

    @Column(nullable = false)
    private boolean disponible = true;

    /** Reservado: hoy el maximo por ruta lo define logistica.rutas.max-pedidos. */
    @Column(name = "capacidad_maxima", nullable = false)
    private int capacidadMaxima = CAPACIDAD_POR_DEFECTO;

    @Column(nullable = false)
    private boolean activo = true;

    protected Repartidor() {
        // requerido por JPA
    }

    public Repartidor(String nombres, String telefono, boolean disponible, int capacidadMaxima) {
        this.nombres = nombres;
        this.telefono = telefono;
        this.disponible = disponible;
        this.capacidadMaxima = capacidadMaxima;
    }

    public Long getId() {
        return id;
    }

    public String getNombres() {
        return nombres;
    }

    public void setNombres(String nombres) {
        this.nombres = nombres;
    }

    public String getTelefono() {
        return telefono;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }

    public boolean isDisponible() {
        return disponible;
    }

    public void setDisponible(boolean disponible) {
        this.disponible = disponible;
    }

    public int getCapacidadMaxima() {
        return capacidadMaxima;
    }

    public void setCapacidadMaxima(int capacidadMaxima) {
        this.capacidadMaxima = capacidadMaxima;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }
}
