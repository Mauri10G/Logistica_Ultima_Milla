package ec.edu.uta.logistica.pedidos.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import ec.edu.uta.logistica.IntegrationTestBase;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.EstadoPedido;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

class PedidoRepositoryIT extends IntegrationTestBase {

    @Autowired
    private PedidoRepository pedidoRepository;
    @Autowired
    private ClienteRepository clienteRepository;
    @Autowired
    private ZonaRepository zonaRepository;
    @Autowired
    private Clock reloj;

    private LocalDate manana() {
        return LocalDate.now(reloj).plusDays(1);
    }

    private Zona zona(String nombre) {
        return zonaRepository.findByNombreIgnoreCase(nombre).orElseThrow();
    }

    private Pedido nuevoPedido(Zona zona, LocalDate fecha, double lat, double lng) {
        Cliente cliente = clienteRepository.save(new Cliente("Cliente IT", "0990000000", null));
        return pedidoRepository.save(new Pedido(cliente, "Direccion IT", GeoUtil.punto(lat, lng), zona, fecha,
                LocalTime.of(10, 0), LocalDateTime.now(reloj), PrioridadPedido.NORMAL, true));
    }

    @Test
    @DisplayName("V2 dejo 20 pedidos de ejemplo para manana, repartidos por zona")
    void datosBase() {
        Page<Pedido> todos = pedidoRepository.buscar(manana(), null, null, PageRequest.of(0, 100));
        Page<Pedido> centro = pedidoRepository.buscar(manana(), zona("Centro").getId(), null, PageRequest.of(0, 100));

        assertThat(todos.getTotalElements()).isEqualTo(20);
        assertThat(centro.getTotalElements()).isEqualTo(6);
        assertThat(todos.getContent()).allMatch(p -> p.getEstado() == EstadoPedido.PENDIENTE && p.getRuta() == null);
    }

    @Test
    @DisplayName("buscar combina los filtros fecha, zona y estado (nulo = sin filtrar)")
    void filtros() {
        Long norte = zona("Norte/Izamba").getId();

        assertThat(pedidoRepository.buscar(manana(), norte, EstadoPedido.PENDIENTE, PageRequest.of(0, 100))
                .getTotalElements()).isEqualTo(4);
        assertThat(pedidoRepository.buscar(manana(), norte, EstadoPedido.ENTREGADO, PageRequest.of(0, 100))
                .getTotalElements()).isZero();
        assertThat(pedidoRepository.buscar(manana().plusYears(5), null, null, PageRequest.of(0, 100))
                .getTotalElements()).isZero();
        // paginacion: total completo aunque la pagina sea corta
        Page<Pedido> pagina = pedidoRepository.buscar(manana(), null, null, PageRequest.of(1, 8));
        assertThat(pagina.getContent()).hasSize(8);
        assertThat(pagina.getTotalElements()).isEqualTo(20);
    }

    @Test
    @DisplayName("zonaIdsConPendientes devuelve las 5 zonas de manana en orden ascendente")
    void zonasConPendientes() {
        List<Long> zonaIds = pedidoRepository.zonaIdsConPendientes(manana(), EstadoPedido.PENDIENTE);

        assertThat(zonaIds).hasSize(5).isSorted();
    }

    @Test
    @DisplayName("guarda la ubicacion como geometria PostGIS y la lee de vuelta")
    void persisteLaGeometria() {
        Pedido guardado = nuevoPedido(zona("Centro"), LocalDate.now(reloj).plusDays(40), -1.2412, -78.6197);

        Pedido leido = pedidoRepository.findById(guardado.getId()).orElseThrow();

        assertThat(leido.getUbicacion().getY()).isEqualTo(-1.2412);
        assertThat(leido.getUbicacion().getX()).isEqualTo(-78.6197);
        assertThat(leido.getUbicacion().getSRID()).isEqualTo(4326);
        assertThat(leido.getEstado()).isEqualTo(EstadoPedido.PENDIENTE);
        assertThat(leido.getVersion()).isZero();
    }

    @Test
    @DisplayName("@Version: la segunda escritura sobre una copia desactualizada falla")
    void bloqueoOptimista() {
        Pedido guardado = nuevoPedido(zona("Centro"), LocalDate.now(reloj).plusDays(41), -1.2412, -78.6197);
        Pedido copiaA = pedidoRepository.findById(guardado.getId()).orElseThrow();
        Pedido copiaB = pedidoRepository.findById(guardado.getId()).orElseThrow();

        copiaA.cambiarEstado(EstadoPedido.ASIGNADO);
        pedidoRepository.saveAndFlush(copiaA);

        copiaB.cambiarEstado(EstadoPedido.ASIGNADO);
        assertThatThrownBy(() -> pedidoRepository.saveAndFlush(copiaB))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }
}
