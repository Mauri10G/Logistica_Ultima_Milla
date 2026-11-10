// Carga: usuarios concurrentes registrando pedidos (POST /api/pedidos) con la carga esperada de un dia normal.
//   k6 run tests/performance/carga.js
//   k6 run -e BASE_URL=http://servidor:8080 tests/performance/carga.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, CABECERAS_JSON, cuerpoPedido, fechaIso } from './comun.js';

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
    checks: ['rate>0.99'],
  },
};

export default function () {
  const respuesta = http.post(`${BASE_URL}/api/pedidos`, cuerpoPedido(fechaIso(30)), {
    ...CABECERAS_JSON,
    tags: { name: 'crear_pedido' },
  });
  check(respuesta, {
    'pedido creado (201)': (r) => r.status === 201,
    'queda PENDIENTE': (r) => r.status === 201 && r.json('estado') === 'PENDIENTE',
  });
  sleep(0.5);
}
