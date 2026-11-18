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
- Fuera de alcance: pasarelas de pago. Hay login con JWT (`POST /api/auth/login`, roles STAFF para la web y COURIER para la
  móvil, contrato en `docs/api-auth.md`); el backend lo aplica solo con `SEGURIDAD_HABILITADA=true` (CORS en `common/config/WebConfig`).

## Estado actual

**Web, backend e integración completos.** Pendiente solo el **móvil (Erick)** y las **pruebas no funcionales (Robert:
volumen, carga, estrés y seguridad)**.

- **Web (Mauricio):** diseño, tablas, confirmaciones y deshacer, zonas contiguas con imán, validación de hora del servidor,
  ajustes manuales de rutas (cambiar repartidor, mover, sacar y reordenar), pruebas Jest y análisis SonarQube.
- **Login encendido e integrado:** `VITE_AUTH_HABILITADA=true` en `web/.env.example`. La web guarda `expiraEn` y cierra la sesión sola
  al vencer ("Tu sesión expiró, ingresa de nuevo"); un 401 `NO_AUTENTICADO` borra la sesión y vuelve al login con el mismo aviso; un
  403 `ACCESO_DENEGADO` muestra "Acceso denegado…" sin cerrar sesión. El WebSocket manda el token en el `CONNECT`. Para probar todo
  hay que levantar el backend con `SEGURIDAD_HABILITADA=true` (ver README, "Login y seguridad").
- **Pantalla "Sin acceso":** un COURIER que entra a la web ve el mismo diseño de dos columnas del login (ilustración de Ambato a la
  izquierda; a la derecha candado, título, texto, nombre del usuario y "Cerrar sesión"). El nombre sale del `sub` del token
  (`SinAccesoPage`, `PanelLogin` compartido con el login).
- **Backend de pedidos terminado:** `GET /api/pedidos` pagina (`page`, `size`, total en `X-Total-Count`), busca (`q`: cliente o
  dirección, sin mayúsculas ni tildes) y ordena (`sort` de Spring: `id`, `cliente`, `direccion`, `zona`, `fechaEntrega`,
  `fechaRegistro`, `estado`; otra columna da 400). Contrato en `docs/api-auth.md`, lógica en `pedidos/repository/ConsultaPedidos`.
- **Pedidos y Seguimiento 100 % contra el backend:** la web ya no trae todo por lotes al buscar u ordenar; ver "Web: rutas y tablas".
- **Pruebas de aceptación:** 27 escenarios en verde con la seguridad encendida (CP-17 busca un pedido que no está en la primera
  página); todos (menos `login.feature`) empiezan con "que el personal inició sesión"; CP-11 cambia el estado con el token del
  repartidor dueño de la ruta (origen MOVIL). Último reporte en `docs/evidencias/aceptacion/`.

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

- Zona del pedido = `ST_Covers` del punto (el borde cuenta; si cae entre dos zonas gana la de menor id); fuera de toda zona → **422** "La dirección no corresponde a ninguna zona configurada" (CP-03).
- No se permite fecha de entrega anterior a hoy → 422 (CP-04). "Hoy" sale del `Clock` en zona `America/Guayaquil`.
- La fecha y hora de entrega deben ser al menos `logistica.pedidos.anticipacion-minima-minutos` (30) después de **ahora**, al
  registrar y al editar → 422 `HORA_ENTREGA_INVALIDA` ("La hora de entrega debe ser al menos 30 minutos después de la hora
  actual del servidor, 19:15"). Ahora sale del `Clock` del backend (a minutos), nunca del computador del usuario; mañana en
  adelante acepta cualquier hora. `GET /api/servidor/hora` devuelve fecha, hora, zona horaria, anticipación mínima y la
  primera entrega aceptada; el modal de pedido de la web la pide al abrirse para fijar fecha mínima, hora mínima de hoy y el
  aviso de hora inválida. Si el endpoint no responde, la web no valida fecha ni hora y muestra el mensaje del backend.
- Solo se edita/elimina un pedido en estado `PENDIENTE` → 409 (CP-05).
- Zona que se superpone con otra (`ST_Relate(..., 'T********')`: solo cuentan los interiores que se cruzan, solo zonas activas) → 409 `ZONA_SUPERPUESTA`, salvo `confirmarSuperposicion=true` (CP-06 a CP-08).
  Las zonas pueden compartir borde o vértices; cruzarse, quedar dentro de otra o contener a otra no (las 5 zonas base son contiguas desde V3).
  Tolerancia: la intersección solo cuenta si supera `logistica.zonas.tolerancia-superposicion-m2` (500 m², área en `geography`); absorbe las diferencias de decimales al pegar un borde al del vecino. Una zona contenida en otra se rechaza siempre.
  Web: el dibujo de zonas tiene imán de 100 m (`RADIO_IMAN_METROS` en `web/src/utils/iman.js`): el clic se pega al vértice más cercano de otra zona activa o, si no hay, a su borde más cercano, y un círculo verde lo anticipa al pasar el mouse.
- `Ruta.agregarPedido` lanza `IllegalStateException` si se supera `max_pedidos` (CP-09). Máximo configurable: `logistica.rutas.max-pedidos: 4`.
- Estados del pedido lineales: `PENDIENTE → ASIGNADO → RECOGIDO → EN_CAMINO → ENTREGADO`; transición inválida → 409. `ASIGNADO` solo lo fija el armado de rutas.
- Estados de ruta: `ARMADA → EN_CURSO` (al recoger el primer pedido) `→ FINALIZADA` (todos entregados).
- Cada cambio de estado se guarda en `historial_estado_pedido` (origen WEB o MOVIL) y se publica en `/topic/pedidos` **después del commit** (CP-11).
- Armado manual (`POST /api/rutas/armar?fecha=`) y programado (`@Scheduled`, 18:00 diario, arma el día siguiente).
- Pedido de último momento: se inserta en la ruta ARMADA con espacio más cercana, o se crea una ruta nueva.

## Web: rutas y tablas

- Rutas: la raíz `/` es **Inicio** y cualquier ruta desconocida (`*`) también redirige a Inicio (`web/src/App.jsx`).
- Todas las tablas (Pedidos, Seguimiento, Zonas, Repartidores) usan `components/Tabla.jsx` + `hooks/useTabla.js`: 10 filas por
  página (selector 10/25/50, "Mostrando 1 a 10 de 24", anterior/siguiente/números), orden al pulsar los encabezados y vuelta a la
  página 1 al cambiar filtro, búsqueda u orden. Zonas y Repartidores ordenan y paginan en el navegador (al cargar, por `#`).
- **Pedidos y Seguimiento paginan, buscan y ordenan en el backend** con `usePedidosTabla` (sobre `useTabla` con la opción `remoto` y
  `TablaVista`): cada cambio de página, tamaño, orden, búsqueda o filtro es una petición
  `GET /api/pedidos?page=&size=&sort=&q=&fecha=&zonaId=&estado=` y el total sale de `X-Total-Count`. Nada se filtra ni se ordena en el
  navegador. El orden con que abre la tabla es por `#` de menor a mayor (`sort=id,asc`). Las columnas pasan a `sort` así: Entrega y
  Hora → `fechaEntrega`, Registro → `fechaRegistro`; Ruta, Historial y Acciones no ordenan. El buscador espera 300 ms tras la
  última tecla (`useRetraso`) y manda `q`. En Seguimiento las pastillas de estado son una consulta de tamaño 1 por estado (solo
  cuenta el total). Solo Inicio usa `listarTodosLosPedidos` (lotes de 1000) para sus tarjetas y el avance del día. En las pruebas
  Jest, `src/__mocks__/backendPedidos.js` simula `GET /api/pedidos` (estado, `q`, `sort`, página).
- Pedidos: filtro de fecha en hoy al abrir (Hoy / Mañana / Todas), buscador por cliente o dirección, botón Ver (modal de solo
  lectura con datos, ruta y historial) y, si el pedido no es PENDIENTE, un candado con tooltip en vez de Editar/Eliminar.
- Rutas: cada ruta es un resumen; los controles de ajuste salen con "Ajustar ruta". El mapa queda fijo y resalta la ruta bajo el mouse.
  El color de borde de cada ruta es el de su línea. Zonas: el color de una zona sale de su id (`colorDeZona`), igual en tabla y mapa.

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
./mvnw spring-boot:run                     # perfil dev, http://localhost:8080 (Swagger: /swagger-ui.html), seguridad apagada
SEGURIDAD_HABILITADA=true ./mvnw spring-boot:run   # con login (PowerShell: $env:SEGURIDAD_HABILITADA="true"; .\mvnw spring-boot:run)
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
cd tests/acceptance && npm install && npm test              # Cucumber + Playwright (backend con SEGURIDAD_HABILITADA=true y web arriba)
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
