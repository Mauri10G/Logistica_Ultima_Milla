// Estres: sube la carga por encima de lo esperado hasta encontrar el punto donde el sistema se degrada.
// Los umbrales son mas laxos que en carga: lo que se busca es ver COMO falla, no que no falle.
//   k6 run tests/performance/estres.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, CABECERAS_JSON, cuerpoPedido, fechaIso } from './comun.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 0 }, // recuperacion
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'], // tolera hasta 10 % de errores
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const respuesta = http.post(`${BASE_URL}/api/pedidos`, cuerpoPedido(fechaIso(31)), CABECERAS_JSON);
  check(respuesta, { 'pedido creado (201)': (r) => r.status === 201 });
  sleep(0.2);
}
