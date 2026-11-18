# Plan de Pruebas de Integración (PPI) — Backend

Responsable: **Joseph Chachalo** (backend). GPIS, Sexto A, Grupo D.
Contenido para la plantilla PPI (`.ods`); cada fila de la tabla de casos es una fila de la hoja de casos de la plantilla.

## 1. Alcance

Integración de los módulos del backend (`seguridad`, `pedidos`, `zonas`, `rutas`, `repartidores`, `seguimiento`) entre
sí y con PostgreSQL 16 + PostGIS a través de la API REST, Flyway, JPA/Hibernate Spatial y los bloqueos de concurrencia.
Fuera de alcance: la web y la app móvil (tienen sus propios planes), pasarelas de pago.

## 2. Estrategia y entorno

| Elemento | Detalle |
|---|---|
| Enfoque | Incremental por módulo, de abajo hacia arriba: repositorios con consultas espaciales → servicios → API REST completa con seguridad |
| Herramientas | JUnit 5, Spring Boot Test (`@SpringBootTest` + MockMvc), Testcontainers con `postgis/postgis:16-3.4`, JaCoCo |
| Ejecución | `cd backend && ./mvnw verify` (failsafe ejecuta las clases `*IT`). También en GitHub Actions en cada PR a `develop` |
| Datos | Migraciones Flyway V1–V5 (5 zonas de Ambato, 6 repartidores, 20 pedidos para mañana, usuarios `staff` y uno por repartidor). Cada clase usa fechas de entrega propias para no interferir |
| Contextos | `IntegrationTestBase`: seguridad apagada (como el perfil dev). `IntegracionConSeguridadBase`: `logistica.seguridad.habilitada=true`, con su propio contenedor PostGIS |
| Criterio de entrada | Unitarias en verde, Docker disponible |
| Criterio de salida | 100 % de casos en verde y cobertura JaCoCo ≥ 80 % (instrucciones y líneas; `verify` falla si baja) |

## 3. Casos de prueba

Resultado obtenido de la ejecución del 2026-11-18 (`./mvnw verify`: 163 unitarias y 66 de integración, BUILD SUCCESS).

| ID | Módulos integrados | Caso | Endpoint / componente | Datos de entrada | Resultado esperado | Resultado obtenido | Prueba automatizada | Estado |
|---|---|---|---|---|---|---|---|---|
| CF0001 | seguridad + BD | Login de STAFF con credenciales correctas | `POST /api/auth/login` | `{usuario: "staff", clave: "staff123"}` | 200 con `token`, `rol: STAFF`, `repartidorId: null`, `expiraEn` | 200 con token JWT HS256, rol STAFF y repartidorId nulo | `SeguridadIT.loginReal` | Aprobado |
| CF0002 | seguridad + repartidores + BD | Login de COURIER sin distinguir mayúsculas | `POST /api/auth/login` | `{usuario: "Carlos", clave: "repartidor123"}` | 200, `rol: COURIER` y su `repartidorId` | 200, COURIER y repartidorId numérico | `SeguridadIT.loginReal` | Aprobado |
| CF0003 | seguridad + BD | Clave incorrecta o usuario inexistente | `POST /api/auth/login` | `staff/mala`, `nadie/clave-incorrecta` | 401 `CREDENCIALES_INVALIDAS`, "Usuario o clave incorrectos" (sin revelar si el usuario existe) | 401 con ese código y mensaje en ambos | `SeguridadIT.loginFallido` | Aprobado |
| CF0004 | seguridad | Login con campos vacíos | `POST /api/auth/login` | `{usuario: ""}` | 400 `VALIDACION` con `errores.usuario` y `errores.clave` | 400 con ambos errores | `SeguridadIT.loginFallido` | Aprobado |
| CF0005 | seguridad | Login con un token viejo en la cabecera | `POST /api/auth/login` | `Authorization: Bearer token.vencido.viejo` | 200 (el login ignora el token) | 200 | `SeguridadIT.loginIgnoraTokenViejo` | Aprobado |
| CF0006 | seguridad + pedidos | Petición sin token o con token inválido | `GET /api/pedidos` | sin cabecera; `Bearer no.es.un.jwt` | 401 `NO_AUTENTICADO` y `WWW-Authenticate: Bearer` | 401 con el código y la cabecera | `SeguridadIT.sinToken` | Aprobado |
| CF0007 | seguridad | Endpoints públicos sin token | `/actuator/health`, `/api/servidor/hora`, `/v3/api-docs` | — | 200; OpenAPI documenta el esquema bearer | 200 en los tres | `SeguridadIT.publicos` | Aprobado |
| CF0008 | seguridad + zonas + repartidores + rutas + seguimiento | COURIER intenta operaciones de STAFF | `POST/GET /api/zonas`, `GET /api/repartidores`, `DELETE /api/pedidos/{id}`, `POST /api/rutas/armar`, `GET /api/seguimiento/...` | token de `luis` | 403 `ACCESO_DENEGADO`; con token de STAFF, 200 | 403 para COURIER y 200 para STAFF | `SeguridadIT.courierNoAdministra` | Aprobado |
| CF0009 | seguridad + pedidos + rutas + seguimiento | COURIER toca un pedido o una ruta ajena; el dueño sí puede | `PATCH /api/pedidos/{id}/estado`, `GET /api/pedidos/{id}`, `GET /api/rutas/{id}`, `GET /api/repartidores/{id}/ruta-actual` | pedido en ruta del repartidor A; tokens de A y de B | B: 403 en los cuatro. A: 200. Historial: origen MOVIL para A y WEB para STAFF aunque el cuerpo diga otra cosa | 403 para B; 200 para A; historial con MOVIL y WEB | `SeguridadIT.courierSoloLoSuyo` | Aprobado |
| CF0010 | seguridad | Cabeceras de seguridad | cualquier respuesta | — | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP (`default-src 'none'` en la API, propia en Swagger), `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cache-Control: no-store` | Todas presentes | `SeguridadIT.cabecerasDeSeguridad` | Aprobado |
| CF0011 | seguridad (CORS) | Preflight de la web y de un origen no permitido | `OPTIONS /api/pedidos` | `Origin: http://localhost:5173` / `http://sitio-malicioso.com` | 200 con `Access-Control-Allow-Origin` / 403 | 200 y 403 | `SeguridadIT.preflightCors` | Aprobado |
| CF0012 | seguridad + WebSocket | CONNECT de STOMP en `/ws` | frame `CONNECT` | sin token, token inválido, token válido | `ERROR`, `ERROR`, `CONNECTED` | `ERROR`, `ERROR`, `CONNECTED` (backend real con `SEGURIDAD_HABILITADA=true`) | `AutenticacionStompInterceptorTest` + prueba manual | Aprobado |
| CF0013 | pedidos + zonas + BD (PostGIS) | Registrar pedido: zona por `ST_Covers`, registro distinto de entrega | `POST /api/pedidos` | punto del Centro, entrega hoy+30 | 201, `Location`, `zonaNombre: Centro`, `PENDIENTE`, `fechaRegistro` | 201 con esos datos | `ApiRestIT.registraPedido` | Aprobado |
| CF0014 | pedidos + zonas | CP-03: dirección fuera de toda zona | `POST /api/pedidos` | lat -1.30, lng -78.50 | 422 `DIRECCION_FUERA_DE_ZONA`, "La dirección no corresponde a ninguna zona configurada" | 422 con ese mensaje | `ApiRestIT.direccionFueraDeZona` | Aprobado |
| CF0015 | pedidos | CP-04: fecha de entrega anterior a hoy | `POST /api/pedidos` | ayer | 422 `FECHA_ENTREGA_PASADA` | 422 | `ApiRestIT.fechaPasada` | Aprobado |
| CF0016 | pedidos | Hora de entrega dentro de la anticipación mínima, al registrar y al editar | `POST` y `PUT /api/pedidos` | hoy 00:00 | 422 `HORA_ENTREGA_INVALIDA` "al menos 30 minutos..." | 422 en ambos | `ApiRestIT.horaDeHoyYaPasada` | Aprobado |
| CF0017 | pedidos | Hora del servidor | `GET /api/servidor/hora` | — | 200 con fecha, hora, `America/Guayaquil`, anticipación 30 y primera entrega aceptada | 200 con todos los campos | `ApiRestIT.horaDelServidor` | Aprobado |
| CF0018 | pedidos | Bean Validation | `POST /api/pedidos` | faltan dirección, longitud, hora; latitud 95 | 400 `VALIDACION` con error por campo | 400 con los 4 errores | `ApiRestIT.validacion` | Aprobado |
| CF0019 | pedidos + rutas + seguimiento | CP-05 y ciclo de vida: no se edita ni borra un ASIGNADO; transiciones; ruta EN_CURSO y FINALIZADA; historial | `PUT/DELETE/PATCH /api/pedidos`, `GET /api/rutas/{id}`, `GET /api/seguimiento/...` | pedido de último momento | 409 `PEDIDO_NO_EDITABLE`, 409 `TRANSICION_INVALIDA`, 422 al fijar ASIGNADO a mano; ruta EN_CURSO → FINALIZADA; 4 registros de historial | Todo según lo esperado | `ApiRestIT.cicloDeVidaDelPedido` | Aprobado |
| CF0020 | pedidos + zonas | Editar un PENDIENTE recalcula su zona; eliminar | `PUT`, `DELETE`, `GET /api/pedidos/{id}` | nuevo punto en Norte/Izamba | 200 con `Norte/Izamba`; 204; luego 404 | 200, 204 y 404 | `ApiRestIT.editaPendiente` | Aprobado |
| CF0021 | pedidos + BD | Listado con filtros y total | `GET /api/pedidos?fecha&estado&size=5` | mañana, PENDIENTE | 200, 5 filas, `X-Total-Count: 20`; estado inexistente → 400 | Según lo esperado | `ApiRestIT.listaConFiltros` | Aprobado |
| CF0022 | rutas + pedidos + repartidores + seguimiento | CP-09: armado por HTTP respeta el máximo de 4 | `POST /api/rutas/armar`, `GET /api/rutas` | 5 pedidos de Centro | 2 rutas (≤ 4 pedidos), orden desde 1; segunda llamada no arma nada; sin fecha → 400 | Según lo esperado | `ApiRestIT.armaRutasPorHttp` | Aprobado |
| CF0023 | rutas + BD (bloqueos) | 20 inserciones de último momento en paralelo | `RutaService.insertarUltimoMomento` | 20 pedidos | Exactamente 5 rutas de 4, ningún pedido duplicado, una sola asignación en el historial | 5 rutas llenas, invariantes cumplidas | `ConcurrenciaRutasIT.insercionesEnParalelo` | Aprobado |
| CF0024 | rutas + BD (bloqueos) | 5 armados simultáneos de la misma fecha | `ArmadoRutasService.armar` | 12 pedidos | 3 rutas, sin duplicados por carreras | 3 rutas | `ConcurrenciaRutasIT.armadosEnParalelo` | Aprobado |
| CF0025 | rutas + BD (bloqueos) | Armado e inserciones de último momento a la vez | armado + 6 inserciones | 14 pedidos | Cada pedido en exactamente una ruta | Invariantes cumplidas | `ConcurrenciaRutasIT.armadoMasInsercionesEnParalelo` | Aprobado |
| CF0026 | rutas + pedidos | Reordenar paradas; orden inválido | `PUT /api/rutas/{id}/orden` | orden invertido; un solo id; lista vacía | 200 con orden 1..4; 422 `ORDEN_INVALIDO`; 400 | Según lo esperado | `AjusteRutasIT.flujoDeAjustes` | Aprobado |
| CF0027 | rutas + pedidos | Mover un pedido a una ruta llena | `POST /api/rutas/{id}/pedidos/{pedidoId}` | ruta con 4 | 409 `RUTA_LLENA`; la ruta origen no cambia | 409 y origen intacto | `AjusteRutasIT.flujoDeAjustes` | Aprobado |
| CF0028 | rutas + pedidos + seguimiento | Sacar un pedido de la ruta | `DELETE /api/rutas/{id}/pedidos/{pedidoId}` | pedido ASIGNADO | 200, la ruta queda con 3 renumerados; el pedido vuelve a PENDIENTE sin ruta | Según lo esperado | `AjusteRutasIT.flujoDeAjustes` | Aprobado |
| CF0029 | rutas + pedidos + seguimiento | Mover entre rutas y desde PENDIENTE; repetido | `POST /api/rutas/{id}/pedidos/{pedidoId}` | pedido de otra ruta; pedido PENDIENTE | 200 en ambos; otra vez al mismo → 409 `PEDIDO_YA_EN_RUTA`; historial ASIGNADO → PENDIENTE → ASIGNADO | Según lo esperado | `AjusteRutasIT.flujoDeAjustes` | Aprobado |
| CF0030 | rutas + repartidores | Cambiar el repartidor de una ruta | `PATCH /api/rutas/{id}/repartidor` | `{repartidorId: 6}`; `{repartidorId: 999999}` | 200 con el nuevo; 404 | 200 y 404 | `AjusteRutasIT.flujoDeAjustes` | Aprobado |
| CF0031 | seguridad + rutas | COURIER hace ajustes; ruta EN_CURSO | los 4 endpoints de ajustes | token del dueño de la ruta | 403 en los 4; con la ruta EN_CURSO, STAFF recibe 409 `RUTA_NO_MODIFICABLE` | 403 y 409 | `AjusteRutasIT.permisosYEstado` | Aprobado |
| CF0032 | rutas + BD (bloqueos) | 10 movimientos simultáneos a una ruta con 1 pedido (máximo 4), desde otra zona | `AjusteRutasService.agregarPedido` | 10 pedidos de Norte | Entran exactamente 3; 7 reciben `RUTA_LLENA`; la ruta queda en 4 | 3 y 7; ruta en 4 | `AjusteRutasIT.movimientosSimultaneosNoSuperanElMaximo` | Aprobado |
| CF0033 | rutas + BD (bloqueos) | Ajustes manuales a la vez que el armado | armado + 8 movimientos | — | Ningún pedido sin ruta ni en dos rutas; posiciones 1..n sin huecos | Invariantes cumplidas | `AjusteRutasIT.ajustesMientrasSeArma` | Aprobado |
| CF0034 | pedidos + rutas + seguimiento | Último momento automático al registrar | `POST /api/pedidos` | fecha sin rutas; luego con una ruta de 2 | Sin rutas: PENDIENTE. Con rutas: ASIGNADO en la ruta existente (orden 3 y 4) y el quinto abre una ruta nueva; un solo ASIGNADO en el historial | Según lo esperado | `UltimoMomentoAutomaticoIT.insertaAlRegistrar` | Aprobado |
| CF0035 | pedidos + rutas + BD (bloqueos) | 12 pedidos de último momento mientras 2 armados corren | `PedidoService.registrar` + `ArmadoRutasService.armar` | 1 + 9 pendientes + 12 nuevos | 22 pedidos en exactamente una ruta, ninguna > 4, sin posiciones repetidas ni asignaciones dobles | Invariantes cumplidas (repetida 3 veces) | `UltimoMomentoAutomaticoIT.ultimoMomentoMientrasSeArma` | Aprobado |
| CF0036 | zonas + BD (PostGIS) | CP-06 a CP-08: superposición y confirmación | `POST/PUT/DELETE /api/zonas` | dos zonas que se cruzan | 409 `ZONA_SUPERPUESTA`; con `confirmarSuperposicion=true` 201/200; nombre repetido 409; GeoJSON no Polygon 400 | Según lo esperado | `ApiRestIT.superposicionDeZonas` | Aprobado |
| CF0037 | zonas + BD (PostGIS) | Zonas contiguas, tolerancia de 500 m² | `POST /api/zonas` | bordes y vértices compartidos, franjas, contención | Compartir borde se acepta; cruce, contención e invasión > 500 m² se rechazan | Según lo esperado | `ZonasContiguasIT`, `ZonaRepositoryIT` | Aprobado |
| CF0038 | repartidores + rutas | Alta, disponibilidad y ruta actual | `POST/PATCH/GET/DELETE /api/repartidores` | repartidor nuevo | 201 con capacidad 4; disponibilidad cambia; `ruta-actual` sin ruta → 404 | Según lo esperado | `ApiRestIT.repartidores` | Aprobado |
| CF0039 | BD (Flyway) | Migraciones y salud | contexto completo | — | V1–V5 aplicadas, PostGIS activo, índices espaciales, `/actuator/health` UP, OpenAPI | Según lo esperado | `LogisticaApplicationIT`, `PedidoRepositoryIT` | Aprobado |

## 4. Resumen de resultados

| Indicador | Valor |
|---|---|
| Casos de integración diseñados | 39 (CF0001–CF0039) |
| Aprobados / fallidos | 39 / 0 |
| Pruebas `*IT` ejecutadas | 66, todas en verde |
| Pruebas unitarias | 163, todas en verde |
| Cobertura JaCoCo (unitarias + integración) | 98,1 % instrucciones · 98,5 % líneas · 88,8 % ramas |
| Defectos encontrados durante la integración | Ver `docs/informe/joseph.md`, sección 3 |
