# CLAUDE.md — Sistema de Gestión de Entregas y Rutas (Logística de Última Milla)

Contexto para cualquier persona (o asistente) que abra este repositorio. Proyecto universitario de la materia
**Gestión de Pruebas e Implantación de Software (GPIS)**, UTA FISEI, Sexto A, Grupo D.
Integrantes: Joseph Chachalo, Mauricio Guevara, Erick López, Robert Paredes.

## Qué es

Un negocio de entregas a domicilio: registra pedidos (fecha de **registro** distinta de fecha de **entrega**), los
agrupa por zona geográfica y fecha de entrega, arma rutas por repartidor con un máximo de pedidos por ruta
(configurable, 4 por defecto), inserta pedidos de último momento y da seguimiento en tiempo real.
La **concurrencia es un requisito crítico**: con muchas solicitudes simultáneas una ruta nunca supera el máximo y un
pedido nunca queda en dos rutas. El sistema se somete a pruebas estáticas, unitarias, integración, sistema/aceptación,
volumen, carga y estrés.

- **App web** (React): personal del negocio. **App móvil** (Flutter): repartidores.
- Módulos funcionales: Registro de pedidos, Gestión de zonas, Armado de rutas, Gestión de repartidores, Seguimiento.
- Fuera de alcance: pasarelas de pago. El login no existe aún (la app móvil elige repartidor por id); el código está
  preparado para agregarlo (CORS centralizado en `common/config/WebConfig`, sin Spring Security todavía).

## Stack — NO CAMBIARLO

| Capa | Tecnología |
|---|---|
| Backend | Java 21, Spring Boot 4.1.2, Maven con `mvnw`. **Sin Lombok** |
| BD | PostgreSQL 16 + PostGIS (Docker `postgis/postgis:16-3.4`), Flyway, Hibernate Spatial + JTS |
| Web | React + Vite, **JavaScript (no TypeScript)**, react-router-dom, axios, Leaflet, `@stomp/stompjs` |
| Móvil | Flutter, `http`, `stomp_dart_client` |
| Tiempo real | Spring WebSocket + STOMP (`/ws`; topics `/topic/pedidos` y `/topic/rutas`) |
| Pruebas | JUnit 5 + Mockito, Spring Boot Test + Testcontainers (postgis), **Jest** (no Vitest) + React Testing Library + user-event v14, `flutter_test` + `integration_test`, Cucumber.js + Playwright, k6, SonarQube + JaCoCo + ESLint, OWASP Dependency-Check + ZAP baseline |

> **Regla: no cambiar el stack ni las herramientas de prueba definidas.** Cualquier cambio se acuerda con el equipo.

## Estructura del monorepo

```
backend/    Spring Boot (paquete base ec.edu.uta.logistica)
web/        React + Vite (src/: api/, components/, pages/, hooks/, services/websocket.js)
mobile/     Flutter (lib/: models/, services/, screens/, widgets/)
tests/      acceptance/ (Cucumber+Playwright, features en español), performance/ (k6), security/, data/ (generador San Valentín)
docs/       diseño del sistema, algoritmo, evidencias
docker-compose.yml   PostGIS (5433) + SonarQube (profile "sonar")
.github/    CI (GitHub Actions) y plantilla de PR
```

### Backend por módulo (cada estudiante trabaja en su carpeta)

```
ec.edu.uta.logistica
├── common/        config (propiedades, CORS, WebSocket, Clock), exception (@RestControllerAdvice), geo (GeoUtil, GeoJsonUtil)
├── pedidos/       entity, repository, service, controller, dto
├── zonas/         entity, repository, service, controller, dto
├── rutas/         entity, repository, service, controller, dto + algoritmo/ (EstrategiaArmadoRutas)
├── repartidores/  entity, repository, service, controller, dto
└── seguimiento/   historial, eventos, WebSocket (publica los cambios de estado)
```

### Responsables por módulo

**Por definir.**

## Reglas de negocio ya implementadas (casos de prueba CP-01 a CP-11)

- Zona del pedido = `ST_Contains` del punto; fuera de toda zona → **422** "La dirección no corresponde a ninguna zona configurada" (CP-03).
- No se permite fecha de entrega anterior a hoy → 422 (CP-04). "Hoy" sale del `Clock` en zona `America/Guayaquil`.
- Solo se edita/elimina un pedido en estado `PENDIENTE` → 409 (CP-05).
- Zona que se superpone con otra (`ST_Intersects`, solo zonas activas) → 409 `ZONA_SUPERPUESTA`, salvo `confirmarSuperposicion=true` (CP-06 a CP-08).
- `Ruta.agregarPedido` lanza `IllegalStateException` si se supera `max_pedidos` (CP-09). Máximo configurable: `logistica.rutas.max-pedidos: 4`.
- Estados del pedido lineales: `PENDIENTE → ASIGNADO → RECOGIDO → EN_CAMINO → ENTREGADO`; transición inválida → 409. `ASIGNADO` solo lo fija el armado de rutas.
- Estados de ruta: `ARMADA → EN_CURSO` (al recoger el primer pedido) `→ FINALIZADA` (todos entregados).
- Cada cambio de estado se guarda en `historial_estado_pedido` (origen WEB o MOVIL) y se publica en `/topic/pedidos` **después del commit** (CP-11).
- Armado manual (`POST /api/rutas/armar?fecha=`) y programado (`@Scheduled`, 18:00 diario, arma el día siguiente).
- Pedido de último momento: se inserta en la ruta ARMADA con espacio más cercana, o se crea una ruta nueva.

## Concurrencia (crítico)

El armado y la inserción de último momento son `@Transactional` y toman, por (zona, fecha): `pg_advisory_xact_lock`
(cubre el caso "aún no hay rutas") + `PESSIMISTIC_WRITE` sobre las rutas existentes. Varias zonas se bloquean en orden
ascendente de id (evita interbloqueos). `@Version` en `ruta` y `pedido` y un índice único `(ruta_id, orden_en_ruta)`
son la red de seguridad. Prueba: `ConcurrenciaRutasIT`. Detalle en `docs/diseno-sistema.md`.

## Algoritmo de armado (a confirmar por el equipo)

Detrás de la interfaz `EstrategiaArmadoRutas`; implementación inicial `ClusterPorZonaVecinoMasCercano`
(agrupa por zona y fecha → clusters de hasta `max_pedidos` por cercanía → orden por vecino más cercano → repartidor con
menos carga). Para cambiarlo: crear otra implementación `@Component` y dejar una sola activa.

## Comandos

```bash
docker compose up -d                       # PostGIS en :5433 (obligatorio para dev y para las *IT)
docker compose --profile sonar up -d       # + SonarQube en :9000

# Backend (cd backend)
./mvnw spring-boot:run                     # perfil dev, http://localhost:8080 (Swagger: /swagger-ui.html)
./mvnw test                                # unitarias (surefire, *Test)
./mvnw verify                              # unitarias + integración Testcontainers (failsafe, *IT) + JaCoCo
./mvnw verify sonar:sonar -Dsonar.token=TOKEN
./mvnw org.owasp:dependency-check-maven:check -Dnvd.api.key=KEY   # la key va como -Dnvd.api.key

# Web (cd web)
npm install && npm run dev                 # http://localhost:5173
npm test                                   # Jest
npm run lint                               # ESLint
npm run build

# Móvil (cd mobile)
flutter pub get && flutter test && flutter analyze
flutter run --dart-define=API_URL=http://10.0.2.2:8080

# Transversales
cd tests/acceptance && npm install && npm test              # Cucumber + Playwright (backend y web arriba)
k6 run tests/performance/smoke.js                           # también carga.js, estres.js, volumen.js
node tests/data/generar-pedidos.js --armar                  # 5000 pedidos de San Valentín
```

## Convenciones

- Código y mensajes de dominio en **español** (nombres de clases, métodos, mensajes de error); infraestructura en inglés.
- DTO + Bean Validation en los controladores; errores uniformes con `GlobalExceptionHandler`.
- Migraciones Flyway: nunca editar una ya aplicada; agregar `V3__...`, `V4__...`.
- Las pruebas `*IT` comparten una base: usar fechas propias (los datos base dejan 20 pedidos para "mañana").
- Ramas: `main ← develop ← feature/<modulo>-<descripcion>`; commits en español con `feat|fix|test|docs|chore:`; todo por PR a `develop` (ver `CONTRIBUTING.md`).
- Windows: usar Git Bash o `cmd`; si PowerShell bloquea npm: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
