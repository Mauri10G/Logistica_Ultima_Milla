# Análisis estático del backend (SonarQube) — issues para crear

Proyecto SonarQube: `logistica-backend` · http://localhost:9000/dashboard?id=logistica-backend
Fecha del análisis: 2026-11-11 · Rama `develop` (commit `76b703f`) · Comando:
`./mvnw verify sonar:sonar -Dsonar.projectKey=logistica-backend -Dsonar.token=…` (el token no se versiona).

En el backend **no se corrigió nada** (esta rama solo toca `web/` y `docs/evidencias/sonar/`): este documento es la lista de
trabajo para crear los Issues de GitHub y asignarlos a Joseph.

## Resumen

| Métrica | Valor |
|---|---|
| Quality Gate | OK |
| Bugs / Vulnerabilidades / Hotspots | 0 / 0 / 0 |
| Code smells | 32 (26 Major, 1 Minor, 5 Info) |
| Cobertura (JaCoCo, unitarias + IT) | 86,2 % (líneas 90,0 % · ramas 71,7 %) |
| Duplicación | 0,0 % |
| Deuda técnica | 695 min (rating A) |
| Pruebas | 80 unitarias + 51 de integración, todas en verde |

| Tipo | Blocker | Critical | Major | Minor | Info | Total |
|---|---|---|---|---|---|---|
| Bug | 0 | 0 | 0 | 0 | 0 | 0 |
| Vulnerabilidad | 0 | 0 | 0 | 0 | 0 | 0 |
| Code smell | 0 | 0 | 26 | 1 | 5 | 32 |

## Issues importantes (código de producción)

### 1. Constructor de `Pedido` con 9 parámetros — `java:S107` (Major)

- **Archivo:** `backend/src/main/java/ec/edu/uta/logistica/pedidos/entity/Pedido.java`, línea 82.
- **Qué dice Sonar:** el constructor tiene 9 parámetros y el máximo es 7.
- **Sugerencia:** agrupar los datos de entrega en un objeto (por ejemplo un `record DatosEntrega(LocalDate fecha, LocalTime hora,
  PrioridadPedido prioridad)`) o usar un *builder*. Se invoca desde `PedidoService.java:67` y desde pruebas
  (`Fabrica.java:46`, `PedidoRepositoryIT.java:48`, `ConcurrenciaRutasIT.java:181`): hay que actualizarlas.
- **Título sugerido:** `refactor: reducir los parámetros del constructor de Pedido (Sonar S107)`

### 2. `LocalDateTime.now()` sin zona ni `Clock` — `java:S8688` (Info)

- **Archivos y líneas:**
  - `backend/src/main/java/ec/edu/uta/logistica/zonas/entity/Zona.java`, líneas 50 y 57 (`@PrePersist` / `@PreUpdate`).
  - `backend/src/main/java/ec/edu/uta/logistica/common/exception/GlobalExceptionHandler.java`, línea 90 (marca de tiempo del error).
- **Por qué importa aquí:** el proyecto define que "hoy" y "ahora" salen del `Clock` en `America/Guayaquil` (ver `CLAUDE.md`). Estas
  tres llamadas usan la zona del servidor, así que pueden dar otra hora si el servidor corre en UTC.
- **Sugerencia:** en el handler, inyectar el `Clock` y usar `LocalDateTime.now(reloj)`. En la entidad `Zona`, que no tiene
  inyección, usar `LocalDateTime.now(ZoneId.of("America/Guayaquil"))` o fijar la fecha desde el servicio.
- **Título sugerido:** `fix: usar el Clock/zona America/Guayaquil en Zona y GlobalExceptionHandler (Sonar S8688)`

### 3. `Math.min(Math.max(...))` en `PedidoService.listar` — `java:S6885` (Major)

- **Archivo:** `backend/src/main/java/ec/edu/uta/logistica/pedidos/service/PedidoService.java`, línea 95.
- **Código:** `int tamanoSeguro = Math.min(Math.max(tamano, 1), 1000);`
- **Sugerencia:** `int tamanoSeguro = Math.clamp(tamano, 1, 1000);` (Java 21). Hay que cubrir los límites en
  `PedidoServiceTest` (0, 1, 1000 y 1001).
- **Título sugerido:** `refactor: usar Math.clamp para limitar el tamaño de página (Sonar S6885)`

### 4. Jerarquía de excepciones con 6 padres — `java:S110` (Major)

- **Archivos y líneas:**
  - `backend/src/main/java/ec/edu/uta/logistica/pedidos/entity/TransicionInvalidaException.java`, línea 5
    (`→ ConflictoException → ApiException → RuntimeException → Exception → Throwable`).
  - `backend/src/main/java/ec/edu/uta/logistica/pedidos/service/DireccionFueraDeZonaException.java`, línea 6
    (`→ ReglaNegocioException → ApiException → …`).
- **Sugerencia:** la jerarquía es intencional (`ConflictoException` fija el estado 409 y `ReglaNegocioException` el 422
  en su constructor). Se puede aplanar (que ambas extiendan directamente de `ApiException` con el código HTTP
  como dato) o, si el equipo prefiere conservarla, marcar el issue como *Accepted* con esa justificación.
- **Título sugerido:** `chore: decidir sobre la profundidad de las excepciones de dominio (Sonar S110)`

## Issues en pruebas (menor prioridad)

### 5. Lambdas de `assertThatThrownBy` / `assertThrows` con más de una llamada — `java:S5778` (Major, 24 casos)

Dentro de la lambda debe haber **una sola** llamada que pueda lanzar la excepción; si hay varias (por ejemplo
`servicio.registrar(solicitud(HOY))`, donde `solicitud(...)` también puede fallar), la prueba podría pasar por la causa
equivocada. **Sugerencia:** construir los argumentos fuera de la lambda
(`var solicitud = solicitud(HOY); assertThatThrownBy(() -> servicio.registrar(solicitud))…`).

| Archivo (bajo `backend/src/test/java/ec/edu/uta/logistica/`) | Líneas |
|---|---|
| `pedidos/service/PedidoServiceTest.java` | 102, 115, 146, 162, 165, 198, 201, 245, 254, 270, 324, 380, 393 |
| `zonas/service/ZonaServiceTest.java` | 67, 81, 205, 214, 225 |
| `rutas/algoritmo/ClusterPorZonaVecinoMasCercanoTest.java` | 122, 124 |
| `rutas/entity/RutaTest.java` | 68, 113 |

- **Título sugerido:** `test: una sola llamada que lanza dentro de cada assertThrows/assertThatThrownBy (Sonar S5778)`

### 6. Import estático de `times` — `java:S8924` (Minor)

- **Archivo:** `backend/src/test/java/ec/edu/uta/logistica/rutas/service/ArmadoRutasServiceTest.java`, línea 120
  (`org.mockito.Mockito.times(3)` escrito completo).
- **Sugerencia:** `import static org.mockito.Mockito.times;` y usar `times(3)`.

### 7. "TODO" que son falsos positivos — `java:S1135` (Info, 2 casos)

- **Archivos:** `ConcurrenciaRutasIT.java`, línea 156 (`// 2) Todo pedido esta asignado…`) y `ZonasContiguasIT.java`, línea 68
  (`// comparte todo el borde este de A`).
- **Qué pasa:** "todo" es la palabra en español, no una tarea pendiente; la regla distingue sin importar mayúsculas.
- **Sugerencia:** cambiar el comentario ("cada pedido…", "comparte el borde este completo de A") o marcar los dos issues como
  *False positive*.

## Cobertura: lo que falta cubrir

Sonar da 86,2 % global. Según el reporte de JaCoCo (`backend/target/site/jacoco/jacoco.csv`), las clases de producción con más
líneas sin cubrir son:

| Clase | Líneas sin cubrir | Ramas sin cubrir |
|---|---|---|
| `rutas.service.ArmadoRutasProgramado` (el `@Scheduled` de las 18:00) | 16 | 0 |
| `common.exception.GlobalExceptionHandler` | 13 | 2 |
| `common.geo.GeoJsonUtil` | 10 | 19 |
| `repartidores.service.RepartidorService` | 8 | 8 |
| `repartidores.entity.Repartidor` | 6 | 0 |
| `rutas.service.RutaService` | 5 | 6 |
| `pedidos.service.PedidoService` | 4 | 10 |
| `zonas.service.ZonaService` | 4 | 5 |

- **Título sugerido:** `test: subir la cobertura del backend de ramas (71,7 %) en GeoJsonUtil, RepartidorService y ArmadoRutasProgramado`

## Orden sugerido para los Issues de GitHub

1. #2 (zona horaria): es el único que puede producir un comportamiento distinto en producción.
2. #1, #3 y #4 (refactor de código de producción).
3. #5, #6 y #7 (pruebas) en un solo Issue de mantenimiento.
4. Cobertura de ramas.
