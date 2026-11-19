# Datos masivos (San Valentín)

Dos formas de poblar el sistema, pensadas para las pruebas de volumen, carga y estrés:

| Herramienta | Qué crea | Cómo |
|---|---|---|
| `generar-pedidos.js` | Repartidores y pedidos **pendientes** para una fecha futura | Por la API (ejercita las reglas de negocio) |
| `volumen.sql` | 100 000 pedidos **históricos** ya entregados, con rutas e historial | Directo en PostgreSQL (rápido) |

Requisitos: `docker compose up -d`, el backend corriendo y Node 18+. No hay dependencias que instalar.

## Escenarios

| Escenario | Pedidos | Repartidores | En paralelo | Representa |
|---|---|---|---|---|
| `normal` | 500 | 10 | 10 | Un día normal de trabajo |
| `alta` (por defecto) | 5 000 | 40 | 20 | Alta demanda: una fecha especial |
| `san-valentin` | 20 000 | 80 | 40 | San Valentín extremo |

```bash
node tests/data/generar-pedidos.js --escenario normal
node tests/data/generar-pedidos.js                               # alta demanda
node tests/data/generar-pedidos.js --escenario san-valentin --armar   # además arma las rutas
```

El generador primero completa los repartidores disponibles hasta el número del escenario (si ya existen no los
duplica, así que se puede ejecutar varias veces) y después registra los pedidos **dentro de las zonas activas**.
Simula un día pico: horas concentradas entre las 10:00 y las 19:00, más pedidos en las primeras zonas,
10 % urgentes / 20 % altos y una parte registrada por el personal. Termina con código 1 si falla más del 1 %.

### Parámetros

| Parámetro | Por defecto | Para qué |
|---|---|---|
| `--escenario` | `alta` | `normal`, `alta` o `san-valentin` |
| `--cantidad` | la del escenario | Número de pedidos |
| `--repartidores` | la del escenario (40 en `alta`) | Repartidores disponibles que debe haber; `0` para no crear |
| `--concurrencia` | la del escenario | Peticiones en paralelo |
| `--fecha` | próximo 14 de febrero | Fecha de entrega `YYYY-MM-DD`; hoy o futura (la API rechaza fechas pasadas, CP-04) |
| `--api` | `http://localhost:8080` | URL del backend |
| `--armar` | no | Arma las rutas de la fecha al terminar |
| `--ayuda` | | Muestra el uso |

### Con login

Cuando el backend tenga la seguridad encendida, indicar el usuario por variables de entorno. El generador hace
login en `POST /api/auth/login` y manda el token en cada petición. Sin `API_USUARIO` no intenta el login.

```bash
API_USUARIO=staff API_CLAVE=staff123 node tests/data/generar-pedidos.js --escenario normal      # Git Bash
set API_USUARIO=staff&& set API_CLAVE=staff123&& node tests/data/generar-pedidos.js              # cmd
```

## Volumen histórico (SQL)

`volumen.sql` inserta pedidos ya entregados en fechas pasadas (último año), dentro de las zonas activas, agrupados
en rutas finalizadas de hasta 4 pedidos y con su historial de estados. Sirve para ver cómo responden las consultas
con la tabla llena. Tarda unos segundos.

```bash
# Git Bash o cmd, desde la raíz del repositorio
docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/volumen.sql
docker exec -i logistica-postgis psql -U logistica -d logistica -v cantidad=500000 -v dias=730 < tests/data/volumen.sql
```

```powershell
# PowerShell
Get-Content tests/data/volumen.sql | docker exec -i logistica-postgis psql -U logistica -d logistica
```

Variables: `cantidad` (100000), `dias` hacia atrás (365), `max` pedidos por ruta (4). Cada ejecución **suma**
pedidos. Los históricos se reconocen por la dirección `HIST-...`; para borrar solo esos datos:

```bash
docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/volumen-limpiar.sql
```

Para empezar con la base vacía: `docker compose down -v && docker compose up -d` y volver a levantar el backend.
Ojo: `down -v` borra todos los volúmenes del proyecto, también los de SonarQube si lo tienes levantado.

## Limpiar los datos de las pruebas

`limpiar-pruebas.sql` borra los pedidos que crearon las pruebas, con sus rutas, su historial y sus clientes, para dejar la
base lista antes de una ronda sin borrar todo con `docker compose down -v`. **Nunca** toca los datos base ni los
históricos de `volumen.sql`.

```bash
# Primero ver qué borraría (no borra nada)
docker exec -i logistica-postgis psql -U logistica -d logistica -v simular=1 < tests/data/limpiar-pruebas.sql

docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/limpiar-pruebas.sql            # todo
docker exec -i logistica-postgis psql -U logistica -d logistica -v origen=k6 < tests/data/limpiar-pruebas.sql
docker exec -i logistica-postgis psql -U logistica -d logistica -v origen=generador -v desde=2028-02-12 -v hasta=2028-02-14 < tests/data/limpiar-pruebas.sql
```

| Variable | Valores | Por defecto |
|---|---|---|
| `origen` | `k6` (pedidos de `tests/performance`), `generador` (de `generar-pedidos.js`) o `todo` | `todo` |
| `desde` / `hasta` | Rango de fechas de entrega `AAAA-MM-DD` | sin límite |
| `simular` | `1` muestra lo que borraría y deshace todo | `0` |

Reconoce cada origen por la dirección que deja: k6 usa `Direccion k6 ...` y el generador `Calle N y Av. M (zona)`.
Con cerca de 760 000 pedidos de prueba tarda unos 20 segundos.

## Receta para las pruebas de volumen

```bash
docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/volumen.sql   # 100 000 históricos
node tests/data/generar-pedidos.js --escenario san-valentin --fecha 2027-02-14             # 20 000 pendientes
k6 run -e FECHA=2027-02-14 -e ARMAR=1 tests/performance/volumen.js                         # consultas + armado
```

## Pruebas del generador

Las pruebas usan el runner integrado de Node y necesitan **Node 22 o superior** (el generador funciona desde Node 18).

```bash
node --test "tests/data/test/*.test.js"
```
