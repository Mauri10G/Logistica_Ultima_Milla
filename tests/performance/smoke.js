// Smoke: confirma que el backend esta arriba antes de lanzar pruebas pesadas.
//   k6 run tests/performance/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from './comun.js';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const respuesta = http.get(`${BASE_URL}/actuator/health`);
  check(respuesta, {
    'health responde 200': (r) => r.status === 200,
    'estado UP': (r) => r.json('status') === 'UP',
  });
  sleep(1);
}
