package ec.edu.uta.logistica.pedidos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "cliente")
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nombres;

    @Column(nullable = false, length = 30)
    private String telefono;

    @Column(length = 150)
    private String email;

    protected Cliente() {
        // requerido por JPA
    }

    public Cliente(String nombres, String telefono, String email) {
        this.nombres = nombres;
        this.telefono = telefono;
        this.email = email;
    }

    public void actualizar(String nombres, String telefono, String email) {
        this.nombres = nombres;
        this.telefono = telefono;
        this.email = email;
    }

    public Long getId() {
        return id;
    }

    public String getNombres() {
        return nombres;
    }

    public String getTelefono() {
        return telefono;
    }

    public String getEmail() {
        return email;
    }
}
