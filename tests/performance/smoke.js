// Smoke: confirma que el backend esta arriba y que el login funciona antes de lanzar pruebas pesadas.
//   k6 run tests/performance/smoke.js
//   k6 run -e API_USUARIO=staff -e API_CLAVE=staff123 tests/performance/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, conToken, iniciarSesion, tokenDelUsuario } from './comun.js';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  iniciarSesion(); // comprueba el login antes de empezar (el token no se devuelve: ver comun.js)
}

export default function () {
  const token = tokenDelUsuario();
  const salud = http.get(`${BASE_URL}/actuator/health`);
  check(salud, {
    'health responde 200': (r) => r.status === 200,
    'estado UP': (r) => r.json('status') === 'UP',
  });

  // Endpoint protegido: responde 401 si el token no llega o no es valido.
  const zonas = http.get(`${BASE_URL}/api/zonas?soloActivas=true`, conToken(token));
  check(zonas, { 'zonas con token 200': (r) => r.status === 200 });
  sleep(1);
}
