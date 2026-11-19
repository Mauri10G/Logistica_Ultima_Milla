# Sistema de Gestión de Entregas y Rutas — Logística de Última Milla

Proyecto de **Gestión de Pruebas e Implantación de Software (GPIS)** — UTA FISEI, Sexto A, Grupo D.

**Integrantes:** Joseph Chachalo · Mauricio Guevara · Erick López · Robert Paredes

Un negocio de entregas a domicilio registra pedidos (con fecha de registro y fecha de entrega), el sistema los agrupa
por zona geográfica y fecha, arma rutas por repartidor respetando un máximo de pedidos por ruta (4 por defecto),
inserta pedidos de último momento y muestra en tiempo real el estado de cada entrega.

- **App web** (personal del negocio): pedidos, zonas, rutas, repartidores y seguimiento en tiempo real.
- **App móvil** (repartidores): ven su ruta, el orden de entregas y marcan cada pedido.

> Esta es la **base** del proyecto: compila, levanta y trae todas las herramientas de prueba configuradas con un
> ejemplo mínimo que pasa. Ver [docs/diseno-sistema.md](docs/diseno-sistema.md) para el diseño y [CLAUDE.md](CLAUDE.md)
> para el resumen técnico.

## Stack (definido por el equipo, no se cambia)

| Capa | Tecnología |
|---|---|
| Backend / API | Java 21 + Spring Boot 4.1.2, Maven (wrapper `mvnw`) |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 (Docker), migraciones Flyway |
| App web | React + Vite (JavaScript), Leaflet |
| App móvil | Flutter |
| Tiempo real | WebSocket + STOMP (Spring WebSocket · `@stomp/stompjs` · `stomp_dart_client`) |

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| **JDK** | **21** (Temurin recomendado). Se probó también con 25: el proyecto compila con `--release 21` | Backend |
| Docker Desktop | 4.x (motor 25+; se probó con 29.8) | PostGIS, Testcontainers, SonarQube, ZAP |
| Node.js | 22 LTS o superior (se probó con 26) y npm 10+ | Web, pruebas de aceptación, generador de datos |
| Flutter | 3.4x estable (se probó con 3.47.4, Dart 3.13) | App móvil |
| k6 | 1.x o superior (se probó con 2.2) | Carga, estrés y volumen |
| Git | 2.40+ | Control de versiones |
| Maven | **No hace falta instalarlo**: se usa `./mvnw` | |

> **Windows:** usar **Git Bash** o `cmd` para los comandos de este README (en PowerShell, npm puede estar bloqueado:
> ver [Problemas comunes](#problemas-comunes-de-la-ape-3)).

## Puertos

| Servicio | Puerto | URL |
|---|---|---|
| Backend (Spring Boot) | 8080 | http://localhost:8080 · Swagger UI: http://localhost:8080/swagger-ui.html |
| WebSocket (STOMP) | 8080 | `ws://localhost:8080/ws` |
| App web (Vite) | 5173 | http://localhost:5173 |
| PostgreSQL + PostGIS | **5433** (no choca con un Postgres local en 5432) | `jdbc:postgresql://localhost:5433/logistica` (usuario/clave: `logistica`) |
| SonarQube (opcional) | 9000 | http://localhost:9000 |

## Cómo levantar todo (paso a paso)

```bash
# 1. Base de datos PostGIS (espera a que esté "healthy")
docker compose up -d
docker compose ps

# 2. Backend (perfil dev por defecto). Flyway crea el esquema y los datos base (5 zonas de Ambato,
#    6 repartidores, 20 pedidos de ejemplo para mañana y los usuarios de prueba)
cd backend
SEGURIDAD_HABILITADA=true ./mvnw spring-boot:run          # Git Bash, con la seguridad (login) encendida
#    Verificar:  http://localhost:8080/actuator/health  ->  {"status":"UP"}

# 3. App web (en otra terminal)
cd web
cp .env.example .env        # VITE_API_URL=http://localhost:8080 y VITE_AUTH_HABILITADA=true
npm install
npm run dev                 # http://localhost:5173  (pide usuario y clave)

# 4. App móvil (en otra terminal) — emulador Android
cd mobile
flutter pub get
flutter run                                              # API por defecto: http://10.0.2.2:8080
flutter run --dart-define=API_URL=http://192.168.1.10:8080   # celular físico: IP de tu PC
```

### Login y seguridad (backend + web)

La web **exige iniciar sesión** (`VITE_AUTH_HABILITADA=true` en `web/.env.example`) y el backend debe correr con la
seguridad encendida (`SEGURIDAD_HABILITADA=true`); si no, el backend deja todo abierto y el login es solo de adorno.

```powershell
# PowerShell (desde backend/)
$env:SEGURIDAD_HABILITADA="true"; .\mvnw spring-boot:run

# cmd:        set SEGURIDAD_HABILITADA=true&& mvnw spring-boot:run
# Git Bash:   SEGURIDAD_HABILITADA=true ./mvnw spring-boot:run
```

Con `$env:SEGURIDAD_HABILITADA` en PowerShell la variable dura lo que dure esa terminal; para volver a la seguridad apagada
basta una terminal nueva (o `Remove-Item Env:SEGURIDAD_HABILITADA`) y poner `VITE_AUTH_HABILITADA=false` en `web/.env`.

Usuarios de prueba (migración `V4__usuarios.sql`; el contrato completo está en [docs/api-auth.md](docs/api-auth.md)):

| Usuario | Clave | Rol | Para qué |
|---|---|---|---|
| `staff` | `staff123` | STAFF | La **web** (personal del negocio): entra a todas las pantallas |
| `carlos`, `luis`, `andrea`, `diego`, `paola`, `marco` | `repartidor123` | COURIER (repartidores 1 a 6) | La **app móvil**. Si uno entra a la web ve "Sin acceso" |

Los repartidores nuevos se crean desde la web (**Repartidores → Nuevo repartidor**): además de nombres y teléfono se escribe su
**usuario** (3 a 50 caracteres: minúsculas, números, punto o guion bajo) y su **contraseña** (mínimo 6). El sistema crea el
repartidor y su usuario COURIER juntos, y con ellos ya puede iniciar sesión en la app móvil. Detalle en
[docs/api-auth.md](docs/api-auth.md#usuarios-de-los-repartidores-nuevos).

La sesión de la web dura 12 horas (`expiraEn` del login); al vencer, o si el backend responde 401, vuelve al login con el aviso
"Tu sesión expiró, ingresa de nuevo". Si un usuario no tiene permiso para algo (403) ve un aviso y la sesión sigue abierta.

Prueba rápida del flujo completo: en la web (usuario `staff`), **Rutas → Mañana → Armar rutas**; en el móvil iniciar sesión con
el usuario de un repartidor, marcar un pedido y ver cómo **Seguimiento** se actualiza solo.

Para reiniciar la base de datos desde cero (se vuelven a aplicar las migraciones al arrancar el backend):
`docker compose down -v && docker compose up -d`.

### Levantar todo con la seguridad encendida (revisión completa)

Es la forma de probar el sistema como queda en producción: el backend exige token y la web exige login. **Las dos
mitades deben coincidir**: backend con `SEGURIDAD_HABILITADA=true` y web con `VITE_AUTH_HABILITADA=true` (en `web/.env`).

```bash
# Terminal 1: base de datos
docker compose up -d

# Terminal 2: backend con login y permisos por rol
cd backend
SEGURIDAD_HABILITADA=true ./mvnw spring-boot:run           # PowerShell: $env:SEGURIDAD_HABILITADA="true"; .\mvnw spring-boot:run

# Terminal 3: web (web/.env con VITE_AUTH_HABILITADA=true)
cd web
npm install && npm run dev                                 # http://localhost:5173

# Terminal 4: pruebas de aceptación (las 27, con el navegador de Playwright)
cd tests/acceptance
npm install && npm run navegador && npm test               # reporte en tests/acceptance/reports/cucumber.html
```

Qué probar a mano: entrar como `staff` / `staff123` y recorrer Pedidos (buscar con o sin tildes, ordenar por cada encabezado,
pasar de página), Seguimiento y Rutas; cerrar sesión y entrar como `carlos` / `repartidor123` para ver la pantalla **Sin
acceso** (con el nombre del usuario y el botón Cerrar sesión). La búsqueda (`q`), el orden (`sort`) y la paginación los
resuelve el backend: ver [docs/api-auth.md](docs/api-auth.md#listado-de-pedidos-filtros-búsqueda-orden-y-paginación).

Al terminar, apaga el backend y la web con `Ctrl+C` en sus terminales (y `docker compose down` si ya no usarás la base).

### Backend con un PostGIS efímero (sin docker compose)

`./mvnw spring-boot:test-run` levanta la app con un contenedor de Testcontainers (clase `TestLogisticaApplication`).

## API principal

Documentación interactiva en **Swagger UI**. Todos los errores devuelven `{ timestamp, status, codigo, mensaje, errores? }`.

| Método y ruta | Descripción |
|---|---|
| `GET/POST /api/pedidos` · `GET/PUT/DELETE /api/pedidos/{id}` | CRUD de pedidos. Filtros: `fecha`, `zonaId`, `estado`; búsqueda `q` (cliente o dirección, sin tildes); orden `sort` (`id`, `cliente`, `direccion`, `zona`, `fechaEntrega`, `fechaRegistro`, `estado`); `page`, `size` (total en `X-Total-Count`). Detalle en `docs/api-auth.md` |
| `PATCH /api/pedidos/{id}/estado` | Lo usa la app móvil: `{"estado":"RECOGIDO","origen":"MOVIL"}` |
| `GET/POST /api/zonas` · `PUT/DELETE /api/zonas/{id}` | Zonas con el polígono en GeoJSON. `?confirmarSuperposicion=true` permite superponer |
| `GET/POST /api/repartidores` · `PUT/DELETE /api/repartidores/{id}` | CRUD de repartidores. El alta (`POST`) pide también `usuario` y `clave` y crea su usuario COURIER para la app móvil |
| `PATCH /api/repartidores/{id}/disponibilidad` · `GET /api/repartidores/{id}/ruta-actual` | Disponibilidad y ruta del día |
| `POST /api/rutas/armar?fecha=YYYY-MM-DD` · `GET /api/rutas?fecha=` | Armado manual y consulta |
| `POST /api/rutas/ultimo-momento/{pedidoId}` | Inserta un pedido en una ruta con espacio o crea una ruta nueva |
| `GET /api/seguimiento/pedidos/{id}/historial` | Línea de tiempo de estados |
| WebSocket `/ws` → `/topic/pedidos`, `/topic/rutas` | Cambios de estado de pedidos y rutas armadas/actualizadas |

El armado también corre **solo** con `@Scheduled`: todos los días a las 18:00 (hora de Ecuador) arma las rutas del día
siguiente. Se configura en `backend/src/main/resources/application.yml` (`logistica.rutas.armado.*`).
Máximo de pedidos por ruta: `logistica.rutas.max-pedidos: 4`.

## Cómo correr cada tipo de prueba

| Tipo | Herramienta | Comando | Requiere |
|---|---|---|---|
| **Unitarias** backend | JUnit 5 + Mockito (surefire, `*Test`) | `cd backend && ./mvnw test` | — |
| **Integración** backend | Spring Boot Test + Testcontainers `postgis/postgis` (failsafe, `*IT`) | `cd backend && ./mvnw verify` | Docker corriendo |
| **Concurrencia** | `ConcurrenciaRutasIT` (parte de `verify`) | `./mvnw verify -Dtest=NoExiste -Dsurefire.failIfNoSpecifiedTests=false -Dit.test=ConcurrenciaRutasIT` | Docker |
| **Cobertura** | JaCoCo (unitarias + integración) | `./mvnw verify` → `backend/target/site/jacoco/index.html` | Docker |
| **Análisis estático** | SonarQube + `sonar-maven-plugin` | `docker compose --profile sonar up -d` → crear token en http://localhost:9000 → `./mvnw verify sonar:sonar -Dsonar.token=TU_TOKEN` | Docker |
| **Estático web** | ESLint | `cd web && npm run lint` | — |
| **Unitarias web** | Jest + React Testing Library + user-event v14 | `cd web && npm test` | — |
| **Unitarias móvil** | `flutter_test` | `cd mobile && flutter test` | — |
| **Integración móvil** | `integration_test` | `cd mobile && flutter test integration_test` | Emulador/dispositivo |
| **Aceptación** | Cucumber.js + Playwright (features en español) | `cd tests/acceptance && npm install && npm run navegador && npm test` | Backend (con `SEGURIDAD_HABILITADA=true`) + web (con `VITE_AUTH_HABILITADA=true`) corriendo |
| **Humo** | k6 | `k6 run tests/performance/smoke.js` | Backend corriendo |
| **Carga** | k6 | `k6 run tests/performance/carga.js` | Backend corriendo |
| **Estrés** | k6 | `k6 run tests/performance/estres.js` | Backend corriendo |
| **Volumen** | k6 + generador | ver abajo | Backend corriendo |
| **Seguridad (dependencias)** | OWASP Dependency-Check | `./mvnw org.owasp:dependency-check-maven:check -Dnvd.api.key=TU_KEY` | API key de NVD |
| **Seguridad (web)** | OWASP ZAP baseline | ver [tests/security/README.md](tests/security/README.md) | Docker + backend |

### Volumen / alta demanda (San Valentín)

```bash
# 5000 pedidos aleatorios dentro de las zonas para el próximo 14 de febrero (vía API) y armado de rutas
node tests/data/generar-pedidos.js --armar
node tests/data/generar-pedidos.js --cantidad 20000 --fecha 2027-02-14 --concurrencia 40   # más volumen

# Medir consultas (y opcionalmente el armado) con esa fecha poblada
k6 run -e FECHA=2027-02-14 tests/performance/volumen.js
k6 run -e FECHA=2027-02-14 -e ARMAR=1 tests/performance/volumen.js
```

Referencia medida en un equipo de desarrollo: 5000 pedidos creados en ~4 s y armado de 1252 rutas en ~11 s.

## Problemas comunes de la APE 3

| Problema | Causa y solución |
|---|---|
| **Testcontainers: `client version 1.32 is too old`** | Un `spring-boot-starter-parent` viejo fijaba un Testcontainers antiguo. Ahora se usa Spring Boot 4.1.2 (Testcontainers 2.x) y surefire/failsafe reciben `-Dapi.version=1.44` (propiedad `docker.api.version` del `pom.xml`). Si Docker Desktop vuelve a quejarse, subir esa propiedad (`-Ddocker.api.version=1.45`) o fijar `<testcontainers.version>` en el `pom.xml`. |
| **Testcontainers: `Could not find a valid Docker environment`** | Docker Desktop no está corriendo. Abrirlo y esperar a que diga "Engine running". |
| **Dependency-Check reporta CVE en `spring-core` o `log4j` transitivos** | Pasaba por usar un Spring Boot viejo. Se usa la última versión estable. Si aparece uno nuevo, subir la versión de Spring Boot en el `pom.xml` y revisar `./mvnw dependency:tree`. |
| **Dependency-Check no usa la key o es lentísimo** | La key se pasa como **`-Dnvd.api.key=TU_KEY`** (no con otro nombre). Sin key, la primera descarga de la base NVD tarda mucho. |
| **PowerShell bloquea `npm`** (`la ejecución de scripts está deshabilitada`) | Ejecutar una vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. O usar **Git Bash** / `cmd`. |
| **El puerto 5433/8080/5173 está ocupado** | Cerrar el proceso que lo usa (`netstat -ano \| findstr :8080`) o cambiar el puerto en `docker-compose.yml` / `application.yml` / `vite.config.js`. |
| **`UnsupportedClassVersionError` o `release 21 not supported`** | Se está usando un JDK menor a 21. Instalar JDK 21 y verificar `java -version` y `JAVA_HOME`. |
| **El backend no arranca: `Connection refused` a `localhost:5433`** | Falta `docker compose up -d` o la base aún no está *healthy*. |
| **Una prueba de integración falla por datos de otra prueba** | Las `*IT` comparten una sola base. Cada prueba debe usar sus propias fechas y no tocar los 20 pedidos de "mañana" de los datos base. |

## Despliegue continuo (CI/CD)

Un push a `develop` publica las imágenes en `ghcr.io/mauri10g/logistica-backend` y `logistica-web` (job `publicar` de
GitHub Actions, solo si el backend y la web pasan sus pruebas). La VM de Azure las baja sola cada minuto con un timer de
systemd (sin abrir SSH a GitHub) y Jenkins en la laptop, que revisa el repositorio cada minuto, despliega en Docker Compose
(http://localhost:8081) y Kubernetes (http://localhost:8082), los dos con el login encendido. Flujo, pasos de una sola vez, guion de
demo y solución de problemas en [docs/despliegue/CICD.md](docs/despliegue/CICD.md).

## Flujo de trabajo en equipo

Ver [CONTRIBUTING.md](CONTRIBUTING.md): ramas `main ← develop ← feature/<modulo>-<descripcion>`, commits en español con
prefijos (`feat`, `fix`, `test`, `docs`, `chore`) y todo entra por Pull Request a `develop`.
