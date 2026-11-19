# Contrato de autenticación y permisos (backend)

Responsable: Joseph Chachalo (backend). Este documento es el contrato entre el backend, la web (Mauricio) y la app
móvil (Erick). Si algo de aquí cambia se avisa antes por el grupo.

## Login

```
POST /api/auth/login
Content-Type: application/json

{ "usuario": "staff", "clave": "staff123" }
```

Respuesta `200 OK`:

```json
{ "token": "eyJhbGciOiJIUzI1NiJ9...", "rol": "STAFF", "repartidorId": null, "expiraEn": "2026-11-19T08:00:00Z" }
```

| Campo | Descripción |
|---|---|
| `token` | JWT firmado con HS256. Se envía en cada petición: `Authorization: Bearer <token>` |
| `rol` | `STAFF` (personal del negocio, usa la web) o `COURIER` (repartidor, usa la app móvil) |
| `repartidorId` | id del repartidor para `COURIER`; `null` para `STAFF` |
| `expiraEn` | instante (UTC) en que vence el token. Por defecto 12 horas (`logistica.seguridad.jwt.expiracion-minutos`) |

Errores (cuerpo uniforme `ErrorRespuesta`: `timestamp`, `status`, `codigo`, `mensaje`):

| Caso | HTTP | `codigo` | `mensaje` |
|---|---|---|---|
| Usuario inexistente, inactivo o clave incorrecta | 401 | `CREDENCIALES_INVALIDAS` | `Usuario o clave incorrectos` |
| Falta `usuario` o `clave` | 400 | `VALIDACION` | detalle por campo en `errores` |

El usuario no distingue mayúsculas (`Staff` = `staff`). La clave sí.

## Usuarios iniciales (migración `V4__usuarios.sql`)

| Usuario | Clave | Rol | repartidorId |
|---|---|---|---|
| `staff` | `staff123` | STAFF | — |
| `carlos` | `repartidor123` | COURIER | 1 (Carlos Mena) |
| `luis` | `repartidor123` | COURIER | 2 (Luis Salazar) |
| `andrea` | `repartidor123` | COURIER | 3 (Andrea Naranjo) |
| `diego` | `repartidor123` | COURIER | 4 (Diego Vargas) |
| `paola` | `repartidor123` | COURIER | 5 (Paola Cevallos) |
| `marco` | `repartidor123` | COURIER | 6 (Marco Villacis) |

Las claves se guardan con BCrypt. Son datos de desarrollo y pruebas: en un despliegue real se cambian.

## Usuarios de los repartidores nuevos

Un repartidor creado desde la web (**Repartidores → Nuevo repartidor**) recibe su usuario COURIER en el mismo momento, para que
pueda iniciar sesión en la app móvil sin tocar la base de datos. `POST /api/repartidores` (solo STAFF) exige, además de los
datos del repartidor, `usuario` y `clave`:

```
POST /api/repartidores
Authorization: Bearer <token de STAFF>
Content-Type: application/json

{ "nombres": "Ana Ruiz", "telefono": "0991234567", "usuario": "ana.ruiz", "clave": "secreto1" }
```

Respuesta `201 Created` (nunca incluye la clave ni su hash):

```json
{ "id": 7, "nombres": "Ana Ruiz", "telefono": "0991234567", "disponible": true, "capacidadMaxima": 4, "activo": true, "usuario": "ana.ruiz" }
```

| Campo | Regla |
|---|---|
| `usuario` | Obligatorio. 3 a 50 caracteres: solo letras **minúsculas**, números, punto o guion bajo (`[a-z0-9._]`) |
| `clave` | Obligatoria. 6 a 72 caracteres (BCrypt solo usa 72 bytes; con tildes u otros caracteres de más de un byte el límite real es de 72 bytes) |

- El repartidor y su usuario (`rol` COURIER, `repartidor_id` del nuevo repartidor, clave con BCrypt) se crean en **una sola
  transacción**: si algo falla no queda un repartidor sin usuario.
- Con ese usuario y clave, `POST /api/auth/login` devuelve un token con `rol: "COURIER"` y el `repartidorId` del nuevo repartidor.
- El usuario no distingue mayúsculas al comparar con los existentes (`Carlos` = `carlos`, índice único sobre `lower(usuario)`).
- `GET /api/repartidores`, `GET /api/repartidores/{id}` y `PUT` devuelven el `usuario` (o `null` si el repartidor no tiene cuenta, por
  ejemplo uno creado antes de este cambio); **nunca** la clave. `PUT /api/repartidores/{id}` sigue sin pedir usuario ni clave: editar un
  repartidor no cambia sus credenciales.

| Caso | HTTP | `codigo` | Detalle |
|---|---|---|---|
| Usuario o clave ausentes o con formato inválido | 400 | `VALIDACION` | `errores.usuario` / `errores.clave` con el mensaje de cada campo |
| Clave de más de 72 bytes | 400 | `SOLICITUD_INVALIDA` | `La clave admite hasta 72 bytes` |
| El usuario ya existe (sin importar mayúsculas) | 409 | `USUARIO_DUPLICADO` | `El usuario 'ana.ruiz' ya existe. Elija otro nombre de usuario.` |
| Un COURIER intenta crear repartidores | 403 | `ACCESO_DENEGADO` | |

La web valida usuario y contraseña con las mismas reglas antes de enviar y muestra el 409 junto al campo Usuario.

## Cada petición

```
Authorization: Bearer <token>
```

| Situación | HTTP | `codigo` |
|---|---|---|
| Sin token, token mal formado, vencido o con firma inválida | 401 | `NO_AUTENTICADO` |
| Token válido pero el rol no tiene permiso, o un COURIER toca algo que no es suyo | 403 | `ACCESO_DENEGADO` |

La web y el móvil deben borrar la sesión y volver al login ante un 401.

## Permisos por endpoint

| Endpoint | STAFF | COURIER |
|---|---|---|
| `POST /api/auth/login`, `GET /api/servidor/hora`, `/actuator/health`, Swagger | público | público |
| `GET/POST/PUT/DELETE /api/zonas/**` | sí | no (403) |
| `GET/POST/PUT/PATCH/DELETE /api/repartidores/**` | sí | no (403), salvo `ruta-actual` |
| `GET /api/repartidores/{id}/ruta-actual` | sí | solo si `{id}` es su `repartidorId`; si no, 403 |
| `GET/POST/PUT/DELETE /api/pedidos/**` | sí | no (403), salvo lo siguiente |
| `GET /api/pedidos/{id}` | sí | solo pedidos de una ruta suya |
| `PATCH /api/pedidos/{id}/estado` | sí | solo pedidos de una ruta suya; si no, 403 |
| `POST /api/rutas/armar`, `/api/rutas/ultimo-momento/**` y los ajustes manuales | sí | no (403) |
| `GET /api/rutas`, `GET /api/rutas/{id}` | sí | `GET /api/rutas/{id}` solo de una ruta suya |
| `GET /api/seguimiento/**` | sí | no (403) |

## Listado de pedidos: filtros, búsqueda, orden y paginación

`GET /api/pedidos` (solo STAFF). Todos los parámetros son opcionales y se combinan:

| Parámetro | Ejemplo | Qué hace |
|---|---|---|
| `fecha` | `fecha=2026-11-19` | Solo pedidos con esa fecha de entrega (`AAAA-MM-DD`) |
| `zonaId` | `zonaId=3` | Solo pedidos de esa zona |
| `estado` | `estado=PENDIENTE` | Solo pedidos en ese estado (`PENDIENTE`, `ASIGNADO`, `RECOGIDO`, `EN_CAMINO`, `ENTREGADO`) |
| `q` | `q=bolivar` | Busca el texto dentro del nombre del cliente **o** de la dirección, sin importar mayúsculas ni tildes (`angela` encuentra "Ángela", `nunez` encuentra "Núñez"). `%` y `_` se buscan como texto. Un texto en blanco no filtra |
| `sort` | `sort=fechaEntrega,desc` | Orden con el formato de Spring: `columna` o `columna,asc` / `columna,desc`. Se puede repetir (`sort=estado,asc&sort=id,desc`) |
| `page` | `page=0` | Número de página, desde 0 (por defecto 0) |
| `size` | `size=10` | Filas por página, de 1 a 1000 (por defecto 100) |

Columnas permitidas en `sort`: `id`, `cliente`, `direccion`, `zona`, `fechaEntrega`, `fechaRegistro` y `estado`.

- `fechaEntrega` ordena por fecha y luego por hora. `estado` ordena por su lugar en el flujo
  (`PENDIENTE` → `ASIGNADO` → `RECOGIDO` → `EN_CAMINO` → `ENTREGADO`), no alfabéticamente.
- Siempre se desempata por `id` ascendente, así una misma fila nunca aparece en dos páginas.
- Sin `sort` el orden es entrega (fecha y hora) y luego `id`.
- Cualquier otra columna da `400` con `codigo` `SOLICITUD_INVALIDA` y la lista de columnas permitidas en `mensaje`.
- La respuesta es la lista de la página pedida y el total de **todas** las páginas (con los filtros y `q` aplicados) va en
  la cabecera `X-Total-Count`.

```
GET /api/pedidos?fecha=2026-11-19&q=bolivar&sort=cliente,asc&page=1&size=10
200 OK
X-Total-Count: 24
[ { "id": 31, "clienteNombres": "...", ... }, ... ]
```

### Origen de los cambios de estado

El campo `origen` del cuerpo de `PATCH /api/pedidos/{id}/estado` **ya no se usa cuando hay sesión**: el backend lo
saca del rol del token (`STAFF` → `WEB`, `COURIER` → `MOVIL`). Se puede seguir enviando sin error, pero se ignora.
Solo con la seguridad apagada (sin token) se toma del cuerpo, como antes, para no romper a nadie.

## WebSocket `/ws` (STOMP)

El token va en la cabecera `Authorization` del frame `CONNECT`:

```
CONNECT
Authorization:Bearer eyJhbGciOiJIUzI1NiJ9...
accept-version:1.2
```

Sin token o con un token inválido el servidor responde con un frame `ERROR` y cierra la conexión. La suscripción a
`/topic/pedidos` y `/topic/rutas` no cambia.

## Propiedad para apagar la seguridad

```yaml
logistica:
  seguridad:
    habilitada: ${SEGURIDAD_HABILITADA:false}
    jwt:
      secreto: ${JWT_SECRETO:...}      # al menos 32 caracteres; en un despliegue real va por variable de entorno
      expiracion-minutos: 720
```

- `habilitada: false` (valor por defecto mientras el equipo termina la integración): todo queda abierto, no se exige
  token y el login igual funciona y devuelve un token válido.
- `habilitada: true`: se aplican las reglas de esta página.

Para levantar el backend con la seguridad encendida:

```bash
SEGURIDAD_HABILITADA=true ./mvnw spring-boot:run          # Git Bash
set SEGURIDAD_HABILITADA=true&& mvnw spring-boot:run      # cmd
```

## Cabeceras de seguridad

Todas las respuestas llevan `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Content-Security-Policy` (estricta para la API; Swagger UI tiene una propia que le permite cargar sus recursos),
`Referrer-Policy: no-referrer`, `Permissions-Policy` y `Cache-Control: no-store`.
