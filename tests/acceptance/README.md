# Pruebas de aceptación (Cucumber.js + Playwright)

Los *features* están en **español** (`# language: es`) y los pasos son deliberadamente simples (pocos imports).

```bash
# 1. Backend y web corriendo (docker compose up -d · ./mvnw spring-boot:run · npm run dev)
# 2. Una sola vez:
cd tests/acceptance
npm install
npm run navegador        # descarga Chromium para Playwright

npm test                 # ejecuta los escenarios
npm run test:dry         # solo valida que todos los pasos estén definidos (no necesita backend)
HEADED=1 npm test        # con el navegador visible
```

Variables: `WEB_URL` (por defecto `http://localhost:5173`) y `API_URL` (por defecto `http://localhost:8080`).
El reporte HTML queda en `reports/cucumber.html`.

Escenario de ejemplo (`features/ruta-maximo-pedidos.feature`): crea 9 pedidos en la zona Centro con la API, arma las rutas
desde la pantalla **Rutas** y comprueba que ninguna ruta tiene más de 4 pedidos y que se crearon 3.
Cada escenario usa una fecha futura al azar para no depender de datos previos.
