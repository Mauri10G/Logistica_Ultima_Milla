# Diseño del sistema

Sistema de Gestión de Entregas y Rutas (Logística de Última Milla) — GPIS, UTA FISEI, Sexto A, Grupo D.

## 1. Visión general

```
┌──────────────┐   REST /api   ┌──────────────────────────────┐        ┌────────────────────┐
│  App web     │ ────────────► │                              │        │                    │
│  React+Vite  │ ◄──────────── │   Backend Spring Boot 4      │ ─────► │ PostgreSQL 16      │
│ (personal)   │  WebSocket    │   (ec.edu.uta.logistica)     │  JPA   │ + PostGIS (5433)   │
└──────────────┘  /topic/*     │                              │ ◄───── │ Flyway V1, V2      │
┌──────────────┐   REST /api   │   @Scheduled: armado diario  │        └────────────────────┘
│  App móvil   │ ────────────► │                              │
│  Flutter     │ ◄──────────── │                              │
│ (repartidor) │  WebSocket    └──────────────────────────────┘
└──────────────┘
```

Un cambio de estado hecho desde el móvil (`PATCH /api/pedidos/{id}/estado`) se guarda, y **después del commit** el
backend lo publica en `/topic/pedidos`; la web suscrita actualiza la tabla de seguimiento sin recargar (CP-11).

## 2. Módulos

Cada módulo del backend tiene sus subpaquetes `entity`, `repository`, `service`, `controller`, `dto`, de modo que cada
persona trabaja en su carpeta.

| Módulo | Responsabilidad | Piezas clave |
|---|---|---|
| `common` | Transversal | `LogisticaProperties` (config propia), `WebConfig` (CORS), `WebSocketConfig` (STOMP en `/ws`), `GlobalExceptionHandler`, `GeoUtil` (haversine, SRID 4326), `GeoJsonUtil` |
| `pedidos` | Registro de pedidos | `Pedido`, `Cliente`, `EstadoPedido` (transiciones), `PedidoService` (zona por `ST_Contains`, fecha, edición solo PENDIENTE), `PATCH .../estado` |
| `zonas` | Gestión de zonas | `Zona` (`geometry(Polygon,4326)`), `ZonaService` (superposición con `ST_Intersects`), GeoJSON |
| `rutas` | Armado de rutas | `Ruta` (`agregarPedido`), `ArmadoRutasService`, `RutaService` (último momento), `BloqueoZonaFecha`, `algoritmo/` |
| `repartidores` | Gestión de repartidores | `Repartidor`, disponibilidad, `GET .../ruta-actual` |
| `seguimiento` | Tiempo real e historial | `SeguimientoService` (historial + evento), `SeguimientoPublicador` (STOMP tras el commit) |

Dependencias entre módulos (solo hacia abajo): `rutas → pedidos, repartidores, zonas, seguimiento`;
`pedidos → zonas, seguimiento`; `seguimiento → pedidos` (solo enums); `common` no depende de nadie.

## 3. Modelo de datos (Flyway `V1__esquema.sql`)

```
zona(id, nombre UNIQUE, area geometry(Polygon,4326), activa, creado_en, actualizado_en)
repartidor(id, nombres, telefono, disponible, capacidad_maxima=4, activo)
cliente(id, nombres, telefono, email?)
ruta(id, fecha, zona_id, repartidor_id, estado, max_pedidos, version)
pedido(id, cliente_id, direccion, ubicacion geometry(Point,4326), zona_id, fecha_entrega, hora_entrega,
       fecha_registro, prioridad, estado, registrado_por_personal, ruta_id?, orden_en_ruta?, version)
historial_estado_pedido(id, pedido_id, estado_anterior?, estado_nuevo, fecha_cambio, origen WEB|MOVIL)
```

Índices: GIST en `zona.area` y `pedido.ubicacion`; compuesto `pedido(fecha_entrega, zona_id, estado)`;
único `pedido(ruta_id, orden_en_ruta)` (red de seguridad de concurrencia).
`V2__datos_base.sql`: 5 zonas de Ambato (Centro, Ingahurco, Ficoa/Atocha, Norte/Izamba, Sur/Huachi) como rectángulos
aproximados que **no se superponen ni se tocan** (margen de ~200 m), 6 repartidores, 10 clientes y 20 pedidos para mañana.

> Los puntos que caen en el margen entre zonas no pertenecen a ninguna y se rechazan con 422. Es intencional (CP-03) y
> hay que tenerlo presente al dibujar zonas reales: conviene que cubran toda el área de servicio.

### Estados

```
Pedido: PENDIENTE → ASIGNADO → RECOGIDO → EN_CAMINO → ENTREGADO     (solo avanza al siguiente; otra transición = 409)
Ruta:   ARMADA → EN_CURSO (se recoge el primer pedido) → FINALIZADA (todos ENTREGADO)
```

`ASIGNADO` no se puede fijar por la API: lo establece el armado de rutas o la inserción de último momento.

## 4. Flujo de datos principal

1. **Registrar pedido** (`POST /api/pedidos`): valida (Bean Validation) → fecha de entrega ≥ hoy (CP-04) → zona por
   `ST_Contains` (CP-03) → crea/usa cliente → guarda `PENDIENTE` con `fecha_registro = ahora`.
2. **Armar rutas** (`POST /api/rutas/armar?fecha=` o `@Scheduled`): ver sección 5.
3. **Repartidor** consulta `GET /api/repartidores/{id}/ruta-actual` y marca `RECOGIDO → EN_CAMINO → ENTREGADO`
   (cada `PATCH` valida la transición, guarda historial y publica en `/topic/pedidos`; la ruta cambia de estado sola).
4. **Último momento** (`POST /api/rutas/ultimo-momento/{pedidoId}`): se inserta en una ruta `ARMADA` de su zona y fecha
   con espacio (la de parada más cercana) o se crea una ruta nueva con el repartidor de menor carga.

### Mensajes WebSocket (STOMP sobre `ws://host:8080/ws`)

| Topic | Cuándo | Cuerpo |
|---|---|---|
| `/topic/pedidos` | Cada cambio de estado | `{pedidoId, estadoAnterior, estadoNuevo, origen, fechaCambio}` |
| `/topic/rutas` | Se arman rutas / una ruta cambia | `{tipo: RUTAS_ARMADAS \| RUTA_ACTUALIZADA, fecha, rutaIds, estado?, motivo?}` |

## 5. Estrategia de armado de rutas

**Estado: implementación inicial, el algoritmo definitivo lo confirma el equipo.** Está detrás de la interfaz
`EstrategiaArmadoRutas` (función pura: no toca la base de datos), por lo que se puede cambiar o comparar fácilmente.

### Implementación actual: `ClusterPorZonaVecinoMasCercano`

1. **Agrupar** los pendientes por `(fecha de entrega, zona)`.
2. **Partir en clusters** de hasta `max_pedidos` por cercanía: se toma como semilla el pedido más alejado del centroide
   de los que quedan y se le suman sus vecinos más cercanos (distancia haversine) hasta llenar el cluster.
3. **Ordenar las paradas** de cada cluster por vecino más cercano, empezando por el pedido con la hora aproximada más
   temprana.
4. **Asignar** cada ruta al repartidor disponible con menos pedidos ese día (empate: menor id).

Es determinista (los empates se resuelven por id). Zonas con pocos pedidos generan rutas de 1 o 2 pedidos.
Medido: 5000 pedidos de San Valentín → 1252 rutas en ~11 s (con 6 repartidores, cada uno recibe muchas rutas: en la
práctica serían viajes sucesivos).

### Limitaciones conocidas / alternativas a evaluar

- El último cluster de una zona puede quedar con 1 pedido (p. ej. 5 pedidos → 4 + 1). Alternativa: balancear (3 + 2).
- El orden por vecino más cercano es una heurística golosa; se puede mejorar con 2-opt.
- La hora aproximada solo decide la primera parada; no hay ventanas de tiempo.
- No considera `capacidad_maxima` del repartidor (campo reservado) ni tiempos de viaje reales (distancia en línea recta).
- Alternativas posibles: k-means / DBSCAN por zona, barrido angular (*sweep*), o un solver de VRP (OR-Tools).

Para cambiar el algoritmo: crear una clase `@Component` que implemente `EstrategiaArmadoRutas`, dejar una sola activa
(`@Primary` o `@ConditionalOnProperty`) y reutilizar `ClusterPorZonaVecinoMasCercanoTest` como modelo de pruebas.

## 6. Concurrencia

Requisito crítico: con muchas solicitudes simultáneas no puede haber una ruta con más de `max_pedidos` ni un pedido en
dos rutas.

- `armar` e `insertarUltimoMomento` son `@Transactional` y toman, **por (zona, fecha)**:
  1. `pg_advisory_xact_lock(zona, fecha)`: exclusión mutua que sí cubre el caso "todavía no existe ninguna ruta"
     (un `SELECT ... FOR UPDATE` no bloquea filas que aún no existen).
  2. `PESSIMISTIC_WRITE` (`FOR UPDATE`) sobre las rutas existentes de esa zona y fecha.
- Los pedidos se leen **después** de tomar los bloqueos (en `insertarUltimoMomento` se hace `refresh` con bloqueo), para
  no operar con datos que otra transacción ya cambió.
- Si hay varias zonas, se bloquean siempre en orden ascendente de id → sin interbloqueos entre armados.
- Red de seguridad: `@Version` en `ruta` y `pedido` (409 `CONFLICTO_CONCURRENCIA` si dos escrituras chocan) e índice
  único `(ruta_id, orden_en_ruta)`.
- Pruebas: `ConcurrenciaRutasIT` — 20 inserciones de último momento en paralelo (`ExecutorService`), 5 armados
  simultáneos y armado + inserciones a la vez; verifica máximo por ruta, asignación única, órdenes sin repetir e
  historial. Se comprobó que **sin los bloqueos estas pruebas fallan**.

## 7. Decisiones de diseño

| Tema | Decisión |
|---|---|
| Errores | Cuerpo uniforme `{timestamp, status, codigo, mensaje, errores?}`. 400 validación/solicitud mal formada · 404 no existe · **409** conflicto de estado (pedido no editable, transición inválida, zona superpuesta, concurrencia) · **422** regla de negocio (fuera de zona, fecha pasada, sin repartidores) |
| Superposición de zonas | `ST_Intersects` sobre zonas activas: dos zonas que **comparten borde** también cuentan como superpuestas (requieren `confirmarSuperposicion=true`). Los datos base dejan margen entre zonas |
| Bajas | Zonas y repartidores se dan de baja lógica (`activa`/`activo = false`) para no romper el historial |
| Hora y fecha | Un `Clock` único en `America/Guayaquil` (`logistica.zona-horaria`); el servidor y CI en UTC no cambian "hoy" |
| Tiempo real | Se publica `AFTER_COMMIT`: nunca se envía un cambio que luego se revierta |
| Autenticación | Aún no; CORS en un solo lugar y sin Spring Security para agregarlo después |
| Paginación | `GET /api/pedidos` devuelve una lista y el total en `X-Total-Count` |

## 8. Casos de prueba cubiertos

| CP | Regla | Dónde se prueba |
|---|---|---|
| CP-03 | Dirección fuera de zona → 422 | `PedidoServiceTest`, `ZonaRepositoryIT`, `ApiRestIT` |
| CP-04 | Fecha de entrega anterior a hoy | `PedidoServiceTest`, `ApiRestIT` |
| CP-05 | Solo se edita un pedido PENDIENTE | `PedidoServiceTest`, `ApiRestIT` |
| CP-06 a CP-08 | Superposición de zonas y `confirmarSuperposicion` | `ZonaServiceTest`, `ZonaRepositoryIT`, `ApiRestIT` |
| CP-09 | Ruta no supera el máximo | `RutaTest`, `ConcurrenciaRutasIT`, feature de aceptación |
| CP-11 | Seguimiento en tiempo real | Verificado a mano con un cliente STOMP real; pendiente automatizar con Playwright |
| — | Transiciones de estado | `EstadoPedidoTest`, `ApiRestIT` |
| — | Algoritmo de rutas | `ClusterPorZonaVecinoMasCercanoTest`, `ArmadoRutasServiceTest` |

Los CP-01, CP-02 y CP-10 no se detallaron en el enunciado de esta base: quedan por mapear por el equipo.

## 9. Pendiente (después de esta base)

- Confirmar el algoritmo de armado y sus parámetros (ver sección 5).
- Disparar la inserción de último momento automáticamente al registrar un pedido cuando ya hay rutas armadas.
- Autenticación y roles; ventana de tiempo para el armado programado por zona.
- Automatizar CP-11 con Playwright (dos páginas: una hace el `PATCH`, la otra observa la tabla).
- Pruebas de seguridad (Dependency-Check y ZAP) ejecutadas y archivadas en `tests/security/reports/` y `docs/evidencias/`.
