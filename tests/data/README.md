# Generador de datos masivos (San Valentín)

`generar-pedidos.js` crea pedidos aleatorios **dentro de las zonas activas** llamando a `POST /api/pedidos` (así se
ejercitan también las reglas de negocio). Solo necesita Node 18+, sin dependencias.

```bash
node tests/data/generar-pedidos.js                      # 5000 pedidos para el próximo 14 de febrero
node tests/data/generar-pedidos.js --cantidad 20000 --fecha 2027-02-14 --concurrencia 40
node tests/data/generar-pedidos.js --armar              # además arma las rutas de esa fecha
node tests/data/generar-pedidos.js --api http://servidor:8080
```

Simula la demanda de un día pico: horas concentradas entre las 10:00 y las 19:00, más pedidos en las primeras zonas,
10 % urgentes / 20 % altos y una parte registrada por el personal. Termina con código 1 si falla más del 1 %.

La fecha debe ser hoy o futura (la API rechaza fechas pasadas, CP-04). Después usar `tests/performance/volumen.js`.
