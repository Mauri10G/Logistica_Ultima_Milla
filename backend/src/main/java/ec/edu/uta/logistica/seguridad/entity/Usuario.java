package ec.edu.uta.logistica.seguridad.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Usuario que puede iniciar sesion. La clave se guarda cifrada con BCrypt (tabla {@code usuario}, V4). */
@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String usuario;

    /** Hash BCrypt, nunca el texto plano. */
    @Column(nullable = false, length = 100)
    private String clave;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Rol rol;

    /** Solo para COURIER: el repartidor que representa. */
    @Column(name = "repartidor_id")
    private Long repartidorId;

    @Column(nullable = false)
    private boolean activo = true;

    protected Usuario() {
        // requerido por JPA
    }

    public Usuario(String usuario, String clave, Rol rol, Long repartidorId) {
        this.usuario = usuario;
        this.clave = clave;
        this.rol = rol;
        this.repartidorId = repartidorId;
    }

    public Long getId() {
        return id;
    }

    public String getUsuario() {
        return usuario;
    }

    public String getClave() {
        return clave;
    }

    public Rol getRol() {
        return rol;
    }

    public Long getRepartidorId() {
        return repartidorId;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }
}
