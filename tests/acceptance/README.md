# Pruebas de aceptación (Cucumber.js + Playwright)

Los *features* están en **español** (`# language: es`) y los pasos son deliberadamente simples (pocos imports).
Estilo de los pasos: el mismo del taller del Vivero Hoja Verde: `page.locator('#id').fill(...)`,
`page.getByRole('button', { name: ... }).click()`, `selectOption`, `nth`, y las comprobaciones con las esperas de Playwright
(`waitFor`) más `assert` de Node. Sin page objects, sin helpers y sin librerías extra.

```bash
# 1. Backend y web corriendo (docker compose up -d · ./mvnw spring-boot:run · npm run dev)
# 2. Una sola vez:
cd tests/acceptance
npm install
npm run navegador        # descarga Chromium para Playwright

npm test                 # ejecuta los escenarios (todo menos @pendiente)
npm run test:dry         # solo valida que todos los pasos estén definidos (no necesita backend)
npm run test:pendientes  # ejecuta solo los @pendiente (hoy fallan: faltan endpoints)
HEADED=1 npm test        # con el navegador visible
npx cucumber-js features/zonas.feature:7   # un escenario por su línea
```

Variables: `WEB_URL` (por defecto `http://localhost:5173`), `API_URL` (por defecto `http://localhost:8080`) y
`DB_CONTENEDOR` (por defecto `logistica-postgis`, el contenedor del `docker compose`).
El reporte HTML queda en `reports/cucumber.html` (`reports/cucumber-pendientes.html` para los `@pendiente`); `reports/` no se versiona.

## Escenarios

| Feature | Escenarios |
|---|---|
| `pedidos.feature` | CP-01 a CP-05 y CP-12 (hora ya pasada para hoy) |
| `zonas.feature` | CP-06 a CP-08 y CP-13 (zona pegada a otra compartiendo borde, sin advertencia) |
| `ruta-maximo-pedidos.feature` | CP-09 |
| `repartidores.feature` | CP-10 |
| `seguimiento.feature` | CP-11 (dos páginas: el "móvil" llama a la API y Seguimiento cambia sin recargar) |
| `rutas-ajustes.feature` `@pendiente` | subir/bajar, sacar, mover y cambiar repartidor: esperan los endpoints de ajuste de Joseph |
| `login.feature` `@pendiente` | login del personal: espera `POST /api/auth/login` y la web con `VITE_AUTH_HABILITADA=true` (ver el feature) |

## Datos de cada escenario

- Cada escenario genera una etiqueta única (`ACEP…`) y la pone en el nombre de todo lo que crea (cliente, zona, repartidor),
  así puede correr en cualquier orden y varias veces.
- Los pedidos que se registran desde la pantalla usan la fecha de **mañana** (la hora del servidor, `GET /api/servidor/hora`);
  los que arman rutas o siguen entregas usan una fecha lejana al azar y sin pedidos, para no mezclarse con los datos base.
- Las zonas de prueba se dibujan en una franja vacía al sur de las zonas base (latitud menor a -1.2730). Un clic en el mapa se
  expresa como latitud/longitud y el paso lo convierte a píxeles (el mapa abre en el centro de Ambato con zoom 13).
- Al terminar, el hook `After` borra de la base lo que lleve la etiqueta del escenario con `docker exec <contenedor> psql`.
  La API solo permite dar de baja zonas y repartidores y no borra pedidos ya asignados, por eso la limpieza va directo a la base.
  Si Docker no responde, la prueba avisa por consola y no falla.
