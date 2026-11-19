// Volumen: con la base ya poblada (ver tests/data: 5000 pedidos de San Valentin), mide consultas y armado.
//   1) node tests/data/generar-pedidos.js --cantidad 5000 --fecha 2027-02-14
//   2) k6 run -e FECHA=2027-02-14 tests/performance/volumen.js
//   Con -e ARMAR=1 se ejecuta una sola vez el armado de rutas de la fecha (operacion pesada).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, conToken, iniciarSesion, tokenDelUsuario } from './comun.js';

const FECHA = __ENV.FECHA || '2027-02-14';

const scenarios = {
  consultas: {
    executor: 'constant-vus',
    vus: 10,
    duration: '1m',
    exec: 'consultas',
  },
};
if (__ENV.ARMAR) {
  scenarios.armado = {
    executor: 'shared-iterations',
    vus: 1,
    iterations: 1,
    maxDuration: '10m',
    exec: 'armado',
  };
}

export const options = {
  scenarios,
  thresholds: {
    'http_req_duration{name:listar_pedidos}': ['p(95)<1500'],
    'http_req_duration{name:listar_rutas}': ['p(95)<2000'],
    'http_req_duration{name:armar_rutas}': ['p(95)<120000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  iniciarSesion(); // comprueba el login antes de empezar (el token no se devuelve: ver comun.js)
}

export function consultas() {
  const token = tokenDelUsuario();
  const pagina = Math.floor(Math.random() * 5);
  const pedidos = http.get(`${BASE_URL}/api/pedidos?fecha=${FECHA}&size=1000&page=${pagina}`,
    conToken(token, { tags: { name: 'listar_pedidos' } }),
  );
  check(pedidos, {
    'listado 200': (r) => r.status === 200,
    'trae X-Total-Count': (r) => r.headers['X-Total-Count'] !== undefined,
  });

  const rutas = http.get(`${BASE_URL}/api/rutas?fecha=${FECHA}`, conToken(token, { tags: { name: 'listar_rutas' } }));
  check(rutas, { 'rutas 200': (r) => r.status === 200 });
  sleep(1);
}

export function armado() {
  const token = tokenDelUsuario();
  const respuesta = http.post(
    `${BASE_URL}/api/rutas/armar?fecha=${FECHA}`,
    null,
    conToken(token, { tags: { name: 'armar_rutas' }, timeout: '10m' }),
  );
  check(respuesta, { 'armado 200': (r) => r.status === 200 });
  console.log(`Armado de ${FECHA}: ${respuesta.json().length} rutas en ${respuesta.timings.duration} ms`);
}
