package ec.edu.uta.logistica.rutas.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import ec.edu.uta.logistica.IntegrationTestBase;
import ec.edu.uta.logistica.common.exception.ConflictoException;
import ec.edu.uta.logistica.common.geo.GeoUtil;
import ec.edu.uta.logistica.pedidos.entity.Cliente;
import ec.edu.uta.logistica.pedidos.entity.Pedido;
import ec.edu.uta.logistica.pedidos.entity.PrioridadPedido;
import ec.edu.uta.logistica.pedidos.repository.ClienteRepository;
import ec.edu.uta.logistica.pedidos.repository.PedidoRepository;
import ec.edu.uta.logistica.zonas.entity.Zona;
import ec.edu.uta.logistica.zonas.repository.ZonaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Prueba de concurrencia (requisito critico): muchas solicitudes simultaneas no deben dejar una ruta con mas
 * pedidos que el maximo, ni un pedido en dos rutas, ni rutas duplicadas por carreras.
 */
class ConcurrenciaRutasIT extends IntegrationTestBase {

    private static final int MAXIMO = 4; // logistica.rutas.max-pedidos

    @Autowired
    private RutaService rutaService;
    @Autowired
    private ArmadoRutasService armadoRutasService;
    @Autowired
    private PedidoRepository pedidoRepository;
    @Autowired
    private ClienteRepository clienteRepository;
    @Autowired
    private ZonaRepository zonaRepository;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private Clock reloj;

    @Test
    @DisplayName("20 inserciones de ultimo momento en paralelo: ninguna ruta pasa de 4 y ningun pedido queda duplicado")
    void insercionesEnParalelo() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(50);
        List<Long> ids = crearPedidosPendientes(fecha, 20);

        List<Callable<Object>> tareas = new ArrayList<>();
        for (Long id : ids) {
            tareas.add(() -> rutaService.insertarUltimoMomento(id));
        }
        List<Throwable> errores = ejecutarEnParalelo(tareas);

        assertThat(errores).as("errores durante las inserciones concurrentes").isEmpty();
        verificarInvariantes(fecha, ids);
        // 20 pedidos con maximo 4 -> exactamente 5 rutas, todas llenas: nunca se crea una ruta mientras otra tiene espacio
        assertThat(jdbc.queryForObject("select count(*) from ruta where fecha = ?", Integer.class, fecha))
                .isEqualTo(5);
        assertThat(jdbc.queryForList("select count(*) from pedido where fecha_entrega = ? group by ruta_id",
                Integer.class, fecha)).containsOnly(MAXIMO);
    }

    @Test
    @DisplayName("5 armados simultaneos de la misma fecha: cada pedido se asigna una sola vez y no hay rutas duplicadas")
    void armadosEnParalelo() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(51);
        List<Long> ids = crearPedidosPendientes(fecha, 12);

        List<Callable<Object>> tareas = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tareas.add(() -> armadoRutasService.armar(fecha));
        }
        List<Throwable> errores = ejecutarEnParalelo(tareas);

        assertThat(errores).as("errores durante los armados concurrentes").isEmpty();
        verificarInvariantes(fecha, ids);
        assertThat(jdbc.queryForObject("select count(*) from ruta where fecha = ?", Integer.class, fecha))
                .as("12 pedidos / maximo 4 = 3 rutas, sin duplicados por carreras").isEqualTo(3);
    }

    @Test
    @DisplayName("armado e inserciones de ultimo momento a la vez: todo pedido queda en exactamente una ruta")
    void armadoMasInsercionesEnParalelo() throws Exception {
        LocalDate fecha = LocalDate.now(reloj).plusDays(52);
        List<Long> pendientes = crearPedidosPendientes(fecha, 8);
        List<Long> deUltimoMomento = crearPedidosPendientes(fecha, 6);

        List<Callable<Object>> tareas = new ArrayList<>();
        tareas.add(() -> armadoRutasService.armar(fecha));
        for (Long id : deUltimoMomento) {
            tareas.add(() -> {
                try {
                    return rutaService.insertarUltimoMomento(id);
                } catch (ConflictoException yaAsignado) {
                    return yaAsignado; // el armado se adelanto: es un resultado valido
                }
            });
        }
        List<Throwable> errores = ejecutarEnParalelo(tareas);

        assertThat(errores).as("errores inesperados").isEmpty();
        List<Long> todos = new ArrayList<>(pendientes);
        todos.addAll(deUltimoMomento);
        verificarInvariantes(fecha, todos);
    }

    /** Lanza todas las tareas a la vez (compuerta CountDownLatch) y devuelve los errores que hubo. */
    private List<Throwable> ejecutarEnParalelo(List<Callable<Object>> tareas) throws Exception {
        ExecutorService ejecutor = Executors.newFixedThreadPool(tareas.size());
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Object>> futuros = new ArrayList<>();
        for (Callable<Object> tarea : tareas) {
            futuros.add(ejecutor.submit(() -> {
                salida.await();
                return tarea.call();
            }));
        }
        salida.countDown();

        List<Throwable> errores = Collections.synchronizedList(new ArrayList<>());
        for (Future<Object> futuro : futuros) {
            try {
                futuro.get(60, TimeUnit.SECONDS);
            } catch (Exception e) {
                errores.add(e.getCause() != null ? e.getCause() : e);
            }
        }
        ejecutor.shutdownNow();
        return errores;
    }

    private void verificarInvariantes(LocalDate fecha, List<Long> idsPedidos) {
        // 1) Ninguna ruta supera su maximo
        assertThat(jdbc.queryForList("""
                select count(*) from pedido p join ruta r on r.id = p.ruta_id
                where r.fecha = ? group by r.id, r.max_pedidos having count(*) > r.max_pedidos
                """, Integer.class, fecha)).as("rutas que superan el maximo").isEmpty();
        assertThat(jdbc.queryForList("select count(*) from pedido where fecha_entrega = ? group by ruta_id",
                Integer.class, fecha)).allMatch(total -> total <= MAXIMO);

        // 2) Todo pedido esta asignado a exactamente una ruta de su misma fecha, y como ASIGNADO
        for (Long id : idsPedidos) {
            assertThat(jdbc.queryForObject("select count(*) from pedido p join ruta r on r.id = p.ruta_id "
                    + "where p.id = ? and p.estado = 'ASIGNADO' and r.fecha = p.fecha_entrega", Integer.class, id))
                    .as("pedido %d asignado", id).isEqualTo(1);
        }
        // 3) Ninguna posicion repetida dentro de una ruta (la unicidad (ruta_id, orden_en_ruta) tambien la impone la BD)
        assertThat(jdbc.queryForObject("select count(*) from (select ruta_id, orden_en_ruta from pedido "
                + "where fecha_entrega = ? and ruta_id is not null group by 1, 2 having count(*) > 1) t",
                Integer.class, fecha)).isZero();
        // 4) Un solo registro de historial PENDIENTE -> ASIGNADO por pedido (no hubo doble asignacion)
        for (Long id : idsPedidos) {
            assertThat(jdbc.queryForObject("select count(*) from historial_estado_pedido where pedido_id = ? "
                    + "and estado_nuevo = 'ASIGNADO'", Integer.class, id)).isEqualTo(1);
        }
        // 5) El total de pedidos en rutas coincide con los creados
        assertThat(jdbc.queryForObject("select count(*) from pedido where fecha_entrega = ? and ruta_id is not null",
                Integer.class, fecha)).isEqualTo(idsPedidos.size());
    }

    private List<Long> crearPedidosPendientes(LocalDate fecha, int cantidad) {
        Zona centro = zonaRepository.findByNombreIgnoreCase("Centro").orElseThrow();
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < cantidad; i++) {
            Cliente cliente = clienteRepository.save(new Cliente("Cliente concurrente " + i, "0990000000", null));
            Pedido pedido = pedidoRepository.save(new Pedido(cliente, "Direccion " + i,
                    GeoUtil.punto(-1.2440 + i * 0.0003, -78.6200 + i * 0.0002), centro, fecha,
                    LocalTime.of(9, 0).plusMinutes(i), LocalDateTime.now(reloj), PrioridadPedido.NORMAL, true));
            ids.add(pedido.getId());
        }
        return ids;
    }
}
