# Informe individual — Backend y pruebas de backend

- **Integrante**: Joseph Damian Chachalo Redroban
- **Rol**: dueño del backend en Spring Boot (`backend/`), migraciones Flyway, sección de backend y del algoritmo de
  `docs/diseno-sistema.md` y Plan de Pruebas de Integración (`docs/plan-pruebas-integracion.md`).
- **Grupo / Materia**: GPIS, Sexto A, Grupo D.

## 1. Alcance y propiedad de archivos

Se trabajó solo en `backend/`, `docs/api-auth.md`, la sección de backend y algoritmo de `docs/diseno-sistema.md`,
`docs/plan-pruebas-integracion.md` y este informe. No se tocaron `web/`, `mobile/` ni `tests/`. Los endpoints que ya
existían no cambiaron de ruta ni de formato.

## 2. Funcionalidad entregada

Cada tarea en su rama corta desde `develop`, con commits pequeños y un PR revisado por CI (GitHub Actions):

| Rama | PR | Qué entrega |
|---|---|---|
| `feature/infra-autenticacion` | #17 | Contrato `docs/api-auth.md`; Spring Security con `spring-boot-starter-oauth2-resource-server` y JWT HS256; migración V4 `usuario` (BCrypt); `POST /api/auth/login`; roles STAFF y COURIER; un COURIER solo toca sus pedidos y rutas (403); origen del historial según el rol; CONNECT de STOMP con token; cabeceras CSP, Referrer-Policy y Permissions-Policy; `logistica.seguridad.habilitada` |
| `feature/rutas-ajustes-manuales` | #18 | `PATCH /api/rutas/{id}/repartidor`, `POST` y `DELETE /api/rutas/{id}/pedidos/{pedidoId}`, `PUT /api/rutas/{id}/orden`, con el mismo bloqueo que el armado y publicación en `/topic/rutas`; migración V5 |
| `feature/pedidos-ultimo-momento-automatico` | #19 | Un pedido registrado para una fecha con rutas armadas se inserta solo como último momento |
| `feature/rutas-algoritmo-ventana-horaria` | #20 | Revisión del algoritmo, ventana horaria opcional al ordenar paradas y documentación de por qué se eligió |
| `feature/backend-cobertura` | #21 | Correcciones de SonarQube, pruebas de cobertura, regla de JaCoCo ≥ 80 %, plan PPI y este informe |

## 3. Hallazgos

### 3.1 Pruebas unitarias (JUnit 5 + Mockito)

| Hallazgo | Cómo se detectó | Corrección |
|---|---|---|
| `expiraEn` del login no coincidía con el `exp` del token (el JWT guarda segundos; el `Instant` tenía nanosegundos) | `AuthServiceTest.loginStaff` | `TokenService` trunca a segundos antes de firmar |
| Spring Security 7 agrega la autoridad `FACTOR_BEARER` además del rol | `SeguridadConfigTest` | La prueba verifica que contenga `ROLE_COURIER` y no `ROLE_STAFF`, sin depender de la lista exacta |
| La hora de entrega solo decidía la primera parada: una ruta podía pasar por un pedido de las 18:00 antes que por uno de las 09:30 | Revisión del algoritmo con `ClusterPorZonaVecinoMasCercanoTest` | Ventana horaria configurable `logistica.rutas.ventana-horaria-minutos` |
| 24 lambdas de `assertThatThrownBy` con más de una llamada (podían pasar por la causa equivocada) | SonarQube `java:S5778` | Los argumentos se construyen fuera de la lambda |

### 3.2 Pruebas de integración (Spring Boot Test + Testcontainers con PostGIS)

| Hallazgo | Cómo se detectó | Corrección |
|---|---|---|
| El índice único `(ruta_id, orden_en_ruta)` se verifica fila por fila: reordenar (intercambiar 1 y 2) o sacar un pedido chocaba a mitad de la transacción aunque el resultado fuera válido | Diseño de los ajustes manuales | V5: `UNIQUE ... DEFERRABLE INITIALLY DEFERRED`, que se verifica al hacer commit y sigue siendo la red de seguridad de concurrencia |
| Un login con un token viejo en la cabecera respondía 401 por el token en vez de validar usuario y clave | `SeguridadIT.loginIgnoraTokenViejo` | El resolvedor de tokens ignora `POST /api/auth/login` |
| Una excepción dentro de un `@Transactional` anidado marca la transacción para *rollback*: si el último momento automático fallaba por falta de repartidores, el registro del pedido también se habría perdido | Análisis de `UltimoMomentoAutomatico` | Se comprueba antes si hay repartidores; si no, el pedido queda PENDIENTE y el registro no falla |
| Las `*IT` comparten base de datos: `ruta-actual` devolvía una ruta EN_CURSO creada por otra clase de prueba | `SeguridadIT.courierSoloLoSuyo` falló al agregar `AjusteRutasIT` | La prueba verifica que la ruta sea del repartidor, no un id concreto. Lección: en una base compartida se aserta sobre lo propio |
| Concurrencia: 10 movimientos simultáneos a una ruta con espacio para 3 | `AjusteRutasIT` | Entran exactamente 3 y los otros 7 reciben `RUTA_LLENA`; nunca se supera el máximo |
| Concurrencia: 12 pedidos de último momento mientras corren 2 armados de la misma fecha | `UltimoMomentoAutomaticoIT` | Cada pedido queda en exactamente una ruta, ninguna supera 4. Repetida 3 veces, siempre en verde |

### 3.3 Análisis estático (SonarQube) — issues de `docs/evidencias/sonar/issues-backend.md`

| Issue | Corrección |
|---|---|
| `java:S8688` `LocalDateTime.now()` sin zona en `Zona` y `GlobalExceptionHandler` | `Clock` de la aplicación en el handler (y en las respuestas 401/403); zona `America/Guayaquil` en `Zona` |
| `java:S107` constructor de `Pedido` con 9 parámetros | `record DatosEntrega(fecha, hora, prioridad)`; el constructor queda con 7 |
| `java:S6885` `Math.min(Math.max(...))` | `Math.clamp(tamano, 1, 1000)`, con pruebas de los límites 0, 1, 1000 y 1001 |
| `java:S110` jerarquía de 6 padres | `TransicionInvalidaException` y `DireccionFueraDeZonaException` extienden `ApiException` directamente, con el mismo estado y código |
| `java:S5778`, `java:S8924`, `java:S1135` (pruebas) | Una llamada por lambda, `import static ...times`, comentarios sin la palabra "todo" |

## 4. Cobertura (JaCoCo, unitarias + integración)

| Momento | Instrucciones | Líneas | Ramas | Pruebas |
|---|---|---|---|---|
| Inicio (develop, 18 nov) | 89,3 % | 90,0 % | 71,7 % | 80 unitarias + 51 IT |
| Final (`feature/backend-cobertura`) | **98,1 %** | **98,5 %** | **88,8 %** | 163 unitarias + 66 IT |

Se agregaron pruebas para lo que el informe de Sonar señalaba sin cubrir (`GeoJsonUtil`, `RepartidorService`,
`ArmadoRutasProgramado`, `GlobalExceptionHandler`). El criterio de finalización del plan ISO (≥ 80 %) quedó
automatizado: `./mvnw verify` falla si la cobertura de instrucciones o de líneas baja de 80 %.

## 5. Qué mejoraría

1. **Encender la seguridad por defecto** cuando la web y el móvil terminen de enviar el token, y pasar el secreto JWT
   por variable de entorno en el despliegue (`JWT_SECRETO` en el *Secret* de Kubernetes): hoy el perfil `prod` hereda
   `habilitada: false` y el secreto de desarrollo.
2. **Dependency-Check y una nueva corrida de SonarQube**: Dependency-Check necesita la API key de NVD, que no está en
   el repositorio; falta ejecutarlo para confirmar cero vulnerabilidades críticas o altas.
3. **Crear el usuario al crear un repartidor**: hoy los COURIER salen de la migración V4; uno nuevo no tiene login.
4. **El armado debería llenar primero las rutas ARMADA con espacio** antes de crear rutas nuevas, y mejorar el orden
   con 2-opt.
5. **Prueba de extremo a extremo del WebSocket** con un cliente STOMP real en una `*IT` con puerto aleatorio (hoy el
   CONNECT se prueba de forma unitaria y se verificó a mano contra el backend real).
6. **Aislar mejor las `*IT`**: la base compartida obliga a usar fechas propias y a asertar solo sobre lo propio.
