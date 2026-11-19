# Pruebas de rendimiento (k6)

Requiere [k6](https://k6.io/docs/get-started/installation/) y el backend corriendo (`http://localhost:8080`).
Cambiar el destino con `-e BASE_URL=http://servidor:8080`.

## Login (token)

Cada script hace login **una sola vez** al empezar (`setup()`), en `POST /api/auth/login`, y manda el token
`Authorization: Bearer ...` en todas sus peticiones (ver `docs/api-auth.md`). Por defecto entra como `staff` / `staff123`;
para usar otro usuario:

```bash
k6 run -e API_USUARIO=staff -e API_CLAVE=staff123 tests/performance/carga.js
```

Si el login falla, la prueba se corta al inicio con el mensaje del backend (por ejemplo `HTTP 401 CREDENCIALES_INVALIDAS`)
en lugar de medir miles de respuestas 401. Funciona igual con la seguridad encendida (`SEGURIDAD_HABILITADA=true`) o apagada.

| Script | Tipo | Qué hace | Umbrales (thresholds) |
|---|---|---|---|
| `smoke.js` | Humo | 1 usuario, 10 s, `GET /actuator/health` y `GET /api/zonas` con token | errores < 1 %, p95 < 500 ms |
| `carga.js` | Carga | Un día normal: 20 usuarios durante 1 min 45 s. Cada acción: 60 % registra un pedido, 25 % consulta los pedidos del día, 15 % consulta las rutas del día | errores < 1 %, p95 < 800 ms, p99 < 1,5 s; rutas p95 < 1,5 s |
| `estres.js` | Estrés | Sube por niveles (50, 100, 200, 400, 600 usuarios, 1 min cada uno) registrando pedidos y luego vuelve a 20 usuarios para medir la recuperación | total: errores < 10 %, p95 < 3 s. Recuperación: errores < 1 %, p95 < 800 ms |
| `volumen.js` | Volumen | Con la base poblada: lista pedidos y rutas de una fecha; opcionalmente arma rutas | listados p95 < 1,5–2 s |
| `concurrencia.js` | Concurrencia | Arma una fecha y lanza muchos pedidos de último momento a la vez en la misma zona, mientras otros usuarios vuelven a armar. Al final verifica las rutas | **ninguna** ruta sobre el máximo ni pedido en dos rutas; errores < 1 %; p95 < 2 s |

```bash
k6 run tests/performance/smoke.js
k6 run tests/performance/carga.js
k6 run tests/performance/estres.js
k6 run tests/performance/concurrencia.js

# Volumen (San Valentín): primero poblar la base
node tests/data/generar-pedidos.js --cantidad 5000 --fecha 2027-02-14
k6 run -e FECHA=2027-02-14 tests/performance/volumen.js
k6 run -e FECHA=2027-02-14 -e ARMAR=1 tests/performance/volumen.js   # incluye el armado de rutas
```

## Estrés: punto de quiebre y recuperación

Cada petición de `estres.js` lleva la etiqueta de su fase (`n050`, `n100`, ..., `bajada`, `recuperacion`), así el
resumen muestra el p95 y la tasa de errores **de cada nivel**. Cada nivel se compara con los umbrales de un día normal
(p95 < 800 ms, errores < 1 %): el **punto de quiebre** es el primer nivel que no los cumple. La fase `recuperacion`
(20 usuarios después de la carga máxima) debe volver a cumplirlos.

```bash
k6 run -e NIVELES=50,100,200,400,800 -e DURACION=2m tests/performance/estres.js   # otros niveles y duración
```

## Concurrencia: pedidos de último momento a la vez

`concurrencia.js` registra 6 pedidos en una fecha, arma sus rutas (quedan 4 + 2, una con espacio) y lanza 200 pedidos más
con 50 usuarios a la vez en la misma zona. Como la fecha ya tiene rutas, el backend inserta cada pedido como último momento
(en una ruta con espacio o en una nueva). Al mismo tiempo 5 usuarios vuelven a armar la misma fecha. Al terminar comprueba
por la API que ninguna ruta supere su máximo, que ningún pedido esté en dos rutas y que no se repita una posición. Si hay
una sola violación, la prueba falla (`violaciones_concurrencia`).

Cada ejecución usa una fecha propia (al azar, a más de 60 días), que se muestra al empezar. La misma verificación en SQL:

```bash
k6 run tests/performance/concurrencia.js                                # muestra "Fecha de la prueba: AAAA-MM-DD"
k6 run -e PEDIDOS=1000 -e USUARIOS=150 tests/performance/concurrencia.js   # más presión
docker exec -i logistica-postgis psql -U logistica -d logistica -v fecha=AAAA-MM-DD < tests/performance/verificar-concurrencia.sql
```

Las tres primeras consultas del SQL deben devolver 0 filas. Si algún pedido es rechazado, el script muestra los dos primeros
de cada usuario con su código HTTP y el resumen cuenta los rechazos por código (`pedidos_rechazados`).

## Guardar los resultados

Los resúmenes van a `tests/performance/reports/` (se versiona, para el informe) y las capturas a `docs/evidencias/performance/`:

```bash
k6 run --summary-export=tests/performance/reports/carga.json tests/performance/carga.js
k6 run --summary-export=tests/performance/reports/estres.json tests/performance/estres.js
k6 run --summary-export=tests/performance/reports/concurrencia.json tests/performance/concurrencia.js
k6 run -e FECHA=2027-02-14 -e ARMAR=1 --summary-export=tests/performance/reports/volumen.json tests/performance/volumen.js
```

Los scripts de carga y estrés **escriben pedidos reales** en la base apuntada: usarlos contra desarrollo, no contra
datos que importen. Para empezar de cero: `docker compose down -v && docker compose up -d`.
`comun.js` tiene las cajas geográficas de las 5 zonas de los datos base; ajustarlas si cambian las zonas.
