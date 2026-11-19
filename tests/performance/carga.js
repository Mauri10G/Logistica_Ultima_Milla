// Carga: la carga esperada de un dia normal. 20 personas del negocio trabajando a la vez: registran pedidos y
// consultan los pedidos y las rutas del dia, como lo hace la web.
//   k6 run tests/performance/carga.js
//   k6 run -e BASE_URL=http://servidor:8080 tests/performance/carga.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, conToken, cuerpoPedido, fechaIso, iniciarSesion, tokenDelUsuario } from './comun.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // sube a 20 usuarios
    { duration: '1m', target: 20 }, // se mantiene
    { duration: '15s', target: 0 }, // baja
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // menos de 1 % de errores
    http_req_duration: ['p(95)<800', 'p(99)<1500'], // ms
    'http_req_duration{name:crear_pedido}': ['p(95)<800'],
    'http_req_duration{name:listar_pedidos}': ['p(95)<800'],
    'http_req_duration{name:listar_rutas}': ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  iniciarSesion(); // comprueba el login antes de empezar (el token no se devuelve: ver comun.js)
}

/** Cada iteracion es una accion de una persona: 60 % registra un pedido, 25 % mira pedidos, 15 % mira rutas. */
export default function () {
  const token = tokenDelUsuario();
  const azar = Math.random();
  if (azar < 0.6) {
    const respuesta = http.post(
      `${BASE_URL}/api/pedidos`,
      cuerpoPedido(fechaIso(30)),
      conToken(token, { tags: { name: 'crear_pedido' } }),
    );
    check(respuesta, {
      'pedido creado (201)': (r) => r.status === 201,
      // ASIGNADO si esa fecha ya tenia rutas armadas (ultimo momento automatico)
      'queda PENDIENTE o ASIGNADO': (r) => r.status === 201 && ['PENDIENTE', 'ASIGNADO'].includes(r.json('estado')),
    });
  } else if (azar < 0.85) {
    // Primera pagina de la tabla de Pedidos de la web (10 filas, filtro "Hoy")
    const respuesta = http.get(
      `${BASE_URL}/api/pedidos?fecha=${fechaIso(0)}&page=0&size=10`,
      conToken(token, { tags: { name: 'listar_pedidos' } }),
    );
    check(respuesta, { 'pedidos del dia (200)': (r) => r.status === 200 });
  } else {
    const respuesta = http.get(
      `${BASE_URL}/api/rutas?fecha=${fechaIso(0)}`,
      conToken(token, { tags: { name: 'listar_rutas' } }),
    );
    check(respuesta, { 'rutas del dia (200)': (r) => r.status === 200 });
  }
  sleep(1);
}
