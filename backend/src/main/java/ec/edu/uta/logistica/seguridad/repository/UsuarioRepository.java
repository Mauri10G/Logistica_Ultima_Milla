package ec.edu.uta.logistica.seguridad.repository;

import java.util.Optional;

import ec.edu.uta.logistica.seguridad.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    /** El nombre de usuario no distingue mayusculas (indice unico sobre lower(usuario)). */
    @Query("select u from Usuario u where lower(u.usuario) = lower(:usuario)")
    Optional<Usuario> buscarPorUsuario(@Param("usuario") String usuario);
}
