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
