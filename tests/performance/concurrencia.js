// Concurrencia: muchos pedidos de ultimo momento entrando al mismo tiempo, en la misma zona y fecha, mientras otros
// usuarios vuelven a disparar el armado de rutas. Al final verifica que ninguna ruta supere su maximo de pedidos,
// que ningun pedido quede en dos rutas y que no se repita una posicion dentro de una ruta.
//
//   k6 run tests/performance/concurrencia.js
//   k6 run -e FECHA=2027-03-01 -e PEDIDOS=500 -e USUARIOS=100 tests/performance/concurrencia.js
//   k6 run -e P95_MAX_MS=30000 tests/performance/concurrencia.js       (umbral de tiempo mas laxo, como en el CI)
//
// Cada ejecucion usa una fecha propia (al azar, a mas de 60 dias) para no mezclarse con otros datos; se muestra al
// inicio y sirve para la verificacion en SQL: tests/performance/verificar-concurrencia.sql.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, conToken, cuerpoPedido, fechaIso, iniciarSesion, tokenDelUsuario } from './comun.js';

const ZONA = __ENV.ZONA || 'Centro'; // todos los pedidos en la misma zona: es donde chocan
const PEDIDOS = Number(__ENV.PEDIDOS || 200); // pedidos de ultimo momento
const USUARIOS = Number(__ENV.USUARIOS || 50); // usuarios registrando a la vez
const P95_MAX_MS = Number(__ENV.P95_MAX_MS || 2000); // en el CI se sube: alli importa la regla, no la velocidad
const INICIALES = 6; // pedidos que se registran y arman antes de la rafaga (4 + 2: deja una ruta con espacio)

const violaciones = new Counter('violaciones_concurrencia');
const rechazados = new Counter('pedidos_rechazados'); // por codigo: ver el resumen con --summary-export
let erroresMostrados = 0;

export const options = {
  scenarios: {
    insercion: {
      executor: 'shared-iterations',
      vus: USUARIOS,
      iterations: PEDIDOS,
      maxDuration: '5m',
      exec: 'registrarUltimoMomento',
    },
    rearmado: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 3,
      maxDuration: '5m',
      exec: 'rearmar',
    },
  },
  thresholds: {
    violaciones_concurrencia: ['count==0'], // la regla critica: si hay una sola, la prueba falla
    // Solo para que el resumen muestre cuantos rechazos hubo de cada tipo (no hacen fallar la prueba).
    'pedidos_rechazados{status:0}': ['count>=0'],
    'pedidos_rechazados{status:409}': ['count>=0'],
    'pedidos_rechazados{status:500}': ['count>=0'],
    'pedidos_rechazados{status:503}': ['count>=0'],
    'checks{escenario:insercion}': ['rate>0.99'],
    'http_req_failed{escenario:insercion}': ['rate<0.01'],
    'http_req_duration{escenario:insercion}': [`p(95)<${P95_MAX_MS}`],
  },
};

export function setup() {
  const token = iniciarSesion();
  // Se decide aqui, una sola vez: el codigo de nivel superior corre en cada usuario virtual.
  const FECHA = __ENV.FECHA || fechaIso(60 + Math.floor(Math.random() * 300));
  console.log(`Fecha de la prueba: ${FECHA} (zona ${ZONA}, ${PEDIDOS} pedidos, ${USUARIOS} usuarios a la vez)`);

  for (let i = 0; i < INICIALES; i++) {
    const r = http.post(`${BASE_URL}/api/pedidos`, cuerpoPedido(FECHA, ZONA), conToken(token, { tags: { name: 'pedido_inicial' } }));
    if (r.status !== 201) throw new Error(`No se pudo registrar un pedido inicial: HTTP ${r.status} ${r.body}`);
  }
  const armado = http.post(`${BASE_URL}/api/rutas/armar?fecha=${FECHA}`, null, conToken(token, { tags: { name: 'armado_inicial' } }));
  if (armado.status !== 200) throw new Error(`No se pudo armar la fecha ${FECHA}: HTTP ${armado.status} ${armado.body}`);
  console.log(`Rutas armadas antes de la rafaga: ${armado.json().length}`);
  return { fecha: FECHA }; // el token no se devuelve: quedaria escrito en el resumen exportado (ver comun.js)
}

/** Un pedido nuevo para una fecha que ya tiene rutas: el backend lo inserta solo (ultimo momento automatico). */
export function registrarUltimoMomento({ fecha }) {
  const token = tokenDelUsuario();
  const r = http.post(
    `${BASE_URL}/api/pedidos`,
    cuerpoPedido(fecha, ZONA),
    conToken(token, { tags: { name: 'pedido_ultimo_momento', escenario: 'insercion' } }),
  );
  if (r.status !== 201) {
    rechazados.add(1, { status: String(r.status) });
    if (erroresMostrados++ < 2) {
      const cuerpo = r.status === 0 ? r.error : String(r.body).slice(0, 160);
      console.warn(`Pedido rechazado: HTTP ${r.status} en ${Math.round(r.timings.duration)} ms. ${cuerpo}`);
    }
  }
  check(r, {
    'pedido creado (201)': (x) => x.status === 201,
    'quedo ASIGNADO a una ruta': (x) => x.status === 201 && x.json('estado') === 'ASIGNADO' && x.json('rutaId') !== null,
  }, { escenario: 'insercion' });
}

/** Otro usuario vuelve a armar la misma fecha mientras entran los pedidos (compite por los mismos bloqueos). */
export function rearmar({ fecha }) {
  const token = tokenDelUsuario();
  const r = http.post(`${BASE_URL}/api/rutas/armar?fecha=${fecha}`, null, conToken(token, { tags: { name: 'rearmado' } }));
  check(r, { 'rearmado sin error (200)': (x) => x.status === 200 });
}

/** Verificacion final con lo que quedo en el sistema. */
export function teardown({ fecha: FECHA }) {
  const token = tokenDelUsuario();
  const rutas = http.get(`${BASE_URL}/api/rutas?fecha=${FECHA}`, conToken(token, { tags: { name: 'verificar_rutas' } })).json();
  // El listado devuelve hasta 1000 por pagina: se recorren todas.
  const pedidos = [];
  for (let pagina = 0; ; pagina++) {
    const lote = http
      .get(`${BASE_URL}/api/pedidos?fecha=${FECHA}&size=1000&page=${pagina}`, conToken(token, { tags: { name: 'verificar_pedidos' } }))
      .json();
    pedidos.push(...lote);
    if (lote.length < 1000) break;
  }

  const problemas = [];
  const rutaDePedido = new Map();
  for (const ruta of rutas) {
    if (ruta.pedidos.length > ruta.maxPedidos) {
      problemas.push(`La ruta ${ruta.id} tiene ${ruta.pedidos.length} pedidos (maximo ${ruta.maxPedidos})`);
    }
    const posiciones = new Set();
    for (const p of ruta.pedidos) {
      if (rutaDePedido.has(p.id)) problemas.push(`El pedido ${p.id} esta en las rutas ${rutaDePedido.get(p.id)} y ${ruta.id}`);
      rutaDePedido.set(p.id, ruta.id);
      if (posiciones.has(p.ordenEnRuta)) problemas.push(`La ruta ${ruta.id} repite la posicion ${p.ordenEnRuta}`);
      posiciones.add(p.ordenEnRuta);
    }
  }
  const sinRuta = pedidos.filter((p) => p.rutaId === null || p.estado !== 'ASIGNADO');
  if (sinRuta.length > 0) problemas.push(`${sinRuta.length} pedidos quedaron sin ruta: ${sinRuta.slice(0, 10).map((p) => p.id).join(', ')}`);

  const esperados = INICIALES + PEDIDOS;
  const maximo = rutas.reduce((m, r) => Math.max(m, r.pedidos.length), 0);
  console.log(
    `Verificacion de ${FECHA}: ${pedidos.length} pedidos (se esperaban al menos ${esperados}), ${rutas.length} rutas, ` +
      `maximo ${maximo} pedidos por ruta, ${rutaDePedido.size} pedidos en rutas.`,
  );
  problemas.forEach((p) => console.error(`VIOLACION: ${p}`));
  violaciones.add(problemas.length);
  check(problemas, { 'ninguna ruta supera el maximo ni hay pedidos duplicados': (p) => p.length === 0 });
}
