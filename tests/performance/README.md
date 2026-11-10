# Pruebas de rendimiento (k6)

Requiere [k6](https://k6.io/docs/get-started/installation/) y el backend corriendo (`http://localhost:8080`).
Cambiar el destino con `-e BASE_URL=http://servidor:8080`.

| Script | Tipo | Qué hace | Umbrales (thresholds) |
|---|---|---|---|
| `smoke.js` | Humo | 1 usuario, 10 s, `GET /actuator/health` | errores < 1 %, p95 < 500 ms |
| `carga.js` | Carga | 20 usuarios 1 min 45 s, `POST /api/pedidos` | errores < 1 %, p95 < 800 ms, p99 < 1,5 s |
| `estres.js` | Estrés | sube de 50 a 300 usuarios, `POST /api/pedidos` | errores < 10 %, p95 < 3 s |
| `volumen.js` | Volumen | con la base poblada: lista pedidos y rutas de una fecha; opcionalmente arma rutas | listados p95 < 1,5–2 s |

```bash
k6 run tests/performance/smoke.js
k6 run tests/performance/carga.js
k6 run tests/performance/estres.js

# Volumen (San Valentín): primero poblar la base
node tests/data/generar-pedidos.js --cantidad 5000 --fecha 2027-02-14
k6 run -e FECHA=2027-02-14 tests/performance/volumen.js
k6 run -e FECHA=2027-02-14 -e ARMAR=1 tests/performance/volumen.js   # incluye el armado de rutas
```

Para guardar resultados: `k6 run --summary-export=tests/performance/resultados/carga.json tests/performance/carga.js`
(la carpeta `resultados/` no se versiona).

Los scripts de carga y estrés **escriben pedidos reales** en la base apuntada: usarlos contra desarrollo, no contra
datos que importen. Para empezar de cero: `docker compose down -v && docker compose up -d`.
`comun.js` tiene las cajas geográficas de las 5 zonas de los datos base; ajustarlas si cambian las zonas.
