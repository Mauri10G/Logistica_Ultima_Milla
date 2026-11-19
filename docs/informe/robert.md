# Informe individual — Datos masivos, pruebas no funcionales, seguridad e infraestructura

- **Integrante**: Robert Andrés Paredes Garzón
- **Rol**: dueño de `tests/data/`, `tests/performance/`, `tests/security/`, `docker-compose.yml` y `.github/workflows/`;
  sección 11 de `docs/diseno-sistema.md` e informe de volumen, carga y estrés (entregable 5).
- **Grupo / Materia**: GPIS, Sexto A, Grupo D.

## 1. Alcance y propiedad de archivos

Se trabajó solo en las carpetas propias, en `docs/evidencias/performance/` y `docs/evidencias/seguridad/`, en la sección 11
de `docs/diseno-sistema.md` y en este informe. Lo encontrado en `backend/`, `web/` y `mobile/` se reportó con Issues
etiquetados `seguridad` o `rendimiento` y asignados al dueño de cada carpeta. La mayoría los corrigieron ellos (#35, #36 y
#37). Para cerrar la ronda de seguridad a tiempo, y por acuerdo del equipo, tres arreglos los hice yo en carpetas ajenas,
cada uno en su propio PR y con las pruebas del dueño pasando: `backend/pom.xml`, `application.yml` y la migración V6 (#47), y
`web/package.json` (#48). No se tocó `mobile/`.

## 2. Trabajo entregado

| Rama | PR | Qué entrega |
|---|---|---|
| `feature/tests-datos-san-valentin` | #4 | Generador con tres escenarios (normal 500, alta 5 000, San Valentín 20 000), repartidores antes de los pedidos, login opcional; `volumen.sql` con 100 000 pedidos históricos y su limpieza |
| `feature/tests-k6-escenarios` | #30 y #46 | Token en los scripts de k6; prueba de concurrencia de último momento con verificación por API y SQL; carga con consultas de rutas; estrés por niveles con recuperación; resultados e informe de volumen, carga y estrés |
| `feature/tests-seguridad` | #39 | Script de ZAP con dos pasadas pasivas y token; npm audit; reporte de seguridad |
| `feature/infra-ci` | #41 | Job de la app móvil en el CI (`flutter analyze` y `flutter test`) |
| `feature/tests-datos-limpieza` | #44 | `limpiar-pruebas.sql`: borra los datos de las pruebas por origen y fecha, con modo de simulación |
| `feature/docs-informe-robert` | #42 | Sección 11 de `docs/diseno-sistema.md` y este informe |
| `feature/backend-seguridad-indice` | #47 | Swagger UI 5.35.1 (DOMPurify corregido) e índice en `pedido.cliente_id` (V6). Toca `backend/` por acuerdo del equipo |
| `feature/web-dependencias-prueba` | #48 | `overrides` de `glob` y `minimatch` en las dependencias de prueba. Toca `web/package.json` por acuerdo del equipo |
| `feature/tests-seguridad-despues` | #49 | Segunda ronda: ZAP, Dependency-Check, npm audit, validación de campos y volumen después de las correcciones |

Issues abiertos para el equipo: #31 (listar rutas lento, Joseph), #32 (validaciones del backend, Joseph), #33
(validaciones de la web, Mauricio), #40 (dependencias de prueba de la web, Mauricio), #43 (Swagger UI con
DOMPurify vulnerable, Joseph), #45 (índice que falta, Joseph) y #34 (seguimiento de mis pendientes).

## 3. Cómo se pobló el sistema

Base con **859 761 pedidos** al final de las pruebas: 100 000 históricos cargados por SQL (un año de operación, con
400 000 cambios de estado), los tres escenarios de demanda registrados por la API a casi 1 000 pedidos por segundo
(500, 5 000 y 20 000 pedidos en fechas propias) y los pedidos que crearon las pruebas de carga y estrés. 80 repartidores y
6 zonas activas. Detalle en `docs/evidencias/performance/README.md`, sección 3.

## 4. Resultados

| Prueba | Resultado |
|---|---|
| Carga, día normal (20 usuarios) | 0 % de errores, p95 de 29 ms al registrar y de 13 a 15 ms al consultar |
| Estrés | Punto de quiebre por tiempo de respuesta en 600 usuarios (p95 1,12 s). Sin errores hasta 1 600 usuarios; capacidad máxima de unas 955 peticiones por segundo; recuperación completa (p95 19–29 ms) |
| Volumen | Armado de 20 000 pedidos en 83 s (5 003 rutas, casi el mínimo posible). Listar pedidos escala bien (p95 0,6 s); listar rutas no (p95 6,96 s con 5 003 rutas) |
| Concurrencia | 3 rondas, hasta 1 006 pedidos con 150 usuarios a la vez: ninguna ruta con más de 4 pedidos y ningún pedido en dos rutas |
| ZAP | 0 hallazgos altos o medios antes y después; 1 bajo (falta `Cross-Origin-Resource-Policy`) |
| npm audit | Producción: 0. Con desarrollo: 18 moderadas antes, **0 después** (#48) |
| Dependency-Check (backend) | 1 dependencia vulnerable antes (DOMPurify en Swagger UI: 1 crítica, 1 alta), **0 después** (#47) |
| Validación de campos | 58 de 63 casos antes, **63 de 63 después** |
| Listar rutas en San Valentín | p95 de 6,96 s antes y 2,80 s después de la corrección de Joseph (#36); sigue sobre el umbral de 2 s |

## 5. Hallazgos

### 5.1 En el sistema (reportados al dueño)

| Hallazgo | Cómo se detectó | Estado |
|---|---|---|
| Listar las rutas de una fecha tarda 6,96 s con 5 003 rutas: cada respuesta trae todas las rutas con todos sus pedidos | Prueba de volumen, San Valentín | #31, corregido por Joseph en #36 (una sola consulta y respuestas comprimidas) |
| El teléfono y el nombre aceptan cualquier texto (`"abc"`, `"12345"`) y la fecha de entrega no tiene máximo | 63 casos de validación contra la API | #32, corregido por Joseph en #35 |
| Los formularios web no limitan la longitud de los campos ni validan el teléfono | Revisión de los formularios | #33, corregido por Mauricio en #37 |
| 18 vulnerabilidades moderadas en `glob` y `minimatch` (cadena de Jest) | npm audit | #40, corregido en #48 (`overrides`) |
| DOMPurify 3.4.16 dentro de Swagger UI 5.34.0, con una vulnerabilidad crítica y una alta (Swagger UI está apagado en producción) | Dependency-Check | #43, corregido en #47 (Swagger UI 5.35.1) |
| `pedido.cliente_id` no tiene índice: borrar clientes revisa toda la tabla de pedidos | Script de limpieza de datos | #45, corregido en #47 (migración V6) |
| Las inserciones de último momento en una misma zona y fecha se atienden una a la vez (unas 7 por segundo): con 150 usuarios a la vez el p95 llega a 8–23 s | Prueba de concurrencia | Propuesta de mejora en el informe de rendimiento |
| El armado de San Valentín tarda 83 s; si se dispara a mano, el usuario espera ese tiempo | Prueba de volumen | Propuesta de mejora en el informe de rendimiento |
| Una ronda de concurrencia tuvo 229 rechazos de 1 000, sin rastro en el log, que no se repitieron | Prueba de concurrencia | Anotado; sin causa confirmada |

### 5.2 En las propias pruebas (corregidos)

| Hallazgo | Corrección |
|---|---|
| Con la seguridad encendida, los scripts de k6 fallaban el 100 % con 401 | Login al empezar y token en cada petición |
| El resumen de `--summary-export` guardaba lo que devuelve `setup()`, y ahí iba el token: se subieron tres resultados con un JWT de desarrollo (firmado con el secreto por defecto, válido 12 horas) | Cada usuario virtual hace su propio login y `setup()` ya no devuelve el token; se quitó el token de los archivos |
| Al importar OpenAPI, ZAP ejecutó también las operaciones `PUT` y `DELETE` y dejó un repartidor como "John Doe" y desactivado | Se restauró el repartidor; el script solo escanea las operaciones de lectura y se comprobó que la base queda idéntica |
| En k6, el código de nivel superior se ejecuta en cada usuario virtual: una fecha al azar salía distinta en cada uno | La fecha se decide una vez en `setup()` |
| El generador terminaba con código 127 en Windows (Node 24) al llamar `process.exit()` con conexiones abiertas | Se usa `process.exitCode` |
| El armado programado de las 18:00 creó rutas durante una prueba y alteró los conteos esperados | Se tomó una nueva línea base; las pruebas usan fechas propias para no mezclarse |

### 5.3 De entorno

- En la máquina de pruebas, IIS ocupaba el puerto 8080: el backend se levantó en el 8081 hasta que se liberó.
- `flutter analyze` se cae en Windows cuando la ruta del proyecto tiene tildes; en una ruta sin tildes y en el CI pasa sin
  problemas. Documentado en `docs/diseno-sistema.md`, sección 11.5.

## 6. Qué mejoraría

- Repetir las pruebas de estrés en un servidor separado del cliente de carga: en el nivel más alto, k6 compite por la CPU
  con el backend en el mismo portátil.
- Agregar al CI una prueba de humo de k6 contra el backend levantado en el job, para detectar a tiempo cambios que rompan
  el contrato de login.
- Automatizar la limpieza de los datos de prueba de carga y estrés por fecha, como ya existe para los históricos.

## 7. Pendiente

Nada obligatorio: la segunda ronda (#49) cumple la meta de ZAP y Dependency-Check sin hallazgos altos. Mejoras opcionales:
paginar `GET /api/rutas` para que San Valentín baje de 2 s y agregar la cabecera `Cross-Origin-Resource-Policy`.
