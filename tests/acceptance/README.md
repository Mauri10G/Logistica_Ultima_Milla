# Pruebas de aceptación (Cucumber.js + Playwright)

Los *features* están en **español** (`# language: es`) y los pasos son deliberadamente simples (pocos imports).
Estilo de los pasos: el mismo del taller del Vivero Hoja Verde: `page.locator('#id').fill(...)`,
`page.getByRole('button', { name: ... }).click()`, `getByText`, `selectOption`, `nth`, y las comprobaciones con las esperas de
Playwright (`waitFor`) más `assert` de Node. Sin page objects, sin helpers y sin librerías extra. La única excepción es CP-11,
que usa `page.request` para simular a la app móvil llamando a la API.

```bash
# 1. Backend y web corriendo (docker compose up -d · ./mvnw spring-boot:run · npm run dev)
# 2. Una sola vez:
cd tests/acceptance
npm install
npm run navegador        # descarga Chromium para Playwright

npm test                 # ejecuta los escenarios (todo menos @pendiente)
npm run test:dry         # solo valida que todos los pasos estén definidos (no necesita backend)
npm run test:pendientes  # ejecuta solo los @pendiente (hoy fallan: faltan endpoints)
npx cucumber-js features/zonas.feature:7   # un escenario por su línea
```

### Ver las pruebas con el navegador visible (`HEADED` y `SLOWMO`)

`HEADED=1` abre el navegador con ventana. `SLOWMO` frena cada acción de Playwright esa cantidad de milisegundos, para poder
seguir los pasos: con `HEADED=1` y sin `SLOWMO` se usa **250**; sin `HEADED` es **0** (pruebas normales y CI, a toda velocidad).

PowerShell (las variables duran lo que dure la sesión; se limpian al terminar):

```powershell
$env:HEADED = '1'; npm test                          # ventana visible, 250 ms por acción
$env:HEADED = '1'; $env:SLOWMO = '600'; npm test     # más lento
$env:HEADED = '1'; $env:SLOWMO = '0'; npm test       # con ventana pero sin frenar
Remove-Item Env:HEADED, Env:SLOWMO -ErrorAction SilentlyContinue
```

Git Bash: `HEADED=1 SLOWMO=600 npm test`. Conviene combinarlo con un solo escenario:
`$env:HEADED = '1'; npx cucumber-js --name "CP-11"`.

Variables: `WEB_URL` (por defecto `http://localhost:5173`), `API_URL` (por defecto `http://localhost:8080`) y
`DB_CONTENEDOR` (por defecto `logistica-postgis`, el contenedor del `docker compose`).
El reporte HTML queda en `reports/cucumber.html` (`reports/cucumber-pendientes.html` para los `@pendiente`); `reports/` no se versiona.
Una copia con la fecha en el nombre se guarda como evidencia en `docs/evidencias/aceptacion/cucumber-AAAA-MM-DD.html`.

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
