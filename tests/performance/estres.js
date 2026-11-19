// Estres: sube los usuarios por niveles hasta pasar la capacidad del sistema y despues vuelve a una carga normal para
// ver si se recupera. Cada peticion queda etiquetada con su fase, asi el resumen muestra el p95 y la tasa de errores
// de cada nivel: el punto de quiebre es el primer nivel donde se rompen los umbrales de "un dia normal".
//
//   k6 run tests/performance/estres.js
//   k6 run -e NIVELES=50,100,200,400,800 -e DURACION=2m tests/performance/estres.js
//   k6 run --summary-export=tests/performance/reports/estres.json tests/performance/estres.js
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { BASE_URL, conToken, cuerpoPedido, fechaIso, iniciarSesion, tokenDelUsuario } from './comun.js';

const NIVELES = (__ENV.NIVELES || '50,100,200,400,600').split(',').map(Number); // usuarios de cada nivel
const DURACION = __ENV.DURACION || '1m'; // cuanto dura cada nivel (s o m)
const USUARIOS_RECUPERACION = 20; // la carga de un dia normal (carga.js)

const segundos = (texto) => (texto.endsWith('m') ? Number(texto.slice(0, -1)) * 60 : Number(texto.replace('s', '')));
const SEG_NIVEL = segundos(DURACION);

// Cada nivel sube en 15 s y se mantiene el resto de DURACION; despues baja a la carga normal y se mantiene.
const stages = [];
NIVELES.forEach((usuarios) => {
  stages.push({ duration: '15s', target: usuarios });
  stages.push({ duration: `${Math.max(SEG_NIVEL - 15, 1)}s`, target: usuarios });
});
stages.push({ duration: '15s', target: USUARIOS_RECUPERACION });
stages.push({ duration: `${SEG_NIVEL}s`, target: USUARIOS_RECUPERACION });
stages.push({ duration: '10s', target: 0 });

/** Fase segun el tiempo transcurrido: "n050", "n100"..., "bajada" (15 s) y "recuperacion". */
function fase() {
  const t = exec.instance.currentTestRunDuration / 1000;
  const nivel = Math.floor(t / SEG_NIVEL);
  if (nivel < NIVELES.length) return `n${String(NIVELES[nivel]).padStart(3, '0')}`;
  return t < NIVELES.length * SEG_NIVEL + 15 ? 'bajada' : 'recuperacion';
}

const thresholds = {
  http_req_failed: ['rate<0.10'], // en estres se tolera hasta 10 % de errores en total
  http_req_duration: ['p(95)<3000'],
  // La recuperacion debe volver a los umbrales de un dia normal.
  'http_req_duration{fase:recuperacion}': ['p(95)<800'],
  'http_req_failed{fase:recuperacion}': ['rate<0.01'],
};
// Una linea por nivel en el resumen (con los umbrales de un dia normal, para ver donde se rompen).
NIVELES.forEach((usuarios) => {
  const etiqueta = `n${String(usuarios).padStart(3, '0')}`;
  thresholds[`http_req_duration{fase:${etiqueta}}`] = [{ threshold: 'p(95)<800', abortOnFail: false }];
  thresholds[`http_req_failed{fase:${etiqueta}}`] = [{ threshold: 'rate<0.01', abortOnFail: false }];
});

export const options = {
  stages,
  thresholds,
  // Que un nivel saturado no haga fallar el script entero: los umbrales de cada nivel se leen en el resumen.
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  iniciarSesion(); // comprueba el login antes de empezar (el token no se devuelve: ver comun.js)
}

export default function () {
  const token = tokenDelUsuario();
  const tags = { name: 'crear_pedido', fase: fase() };
  const respuesta = http.post(`${BASE_URL}/api/pedidos`, cuerpoPedido(fechaIso(31)), conToken(token, { tags }));
  check(respuesta, { 'pedido creado (201)': (r) => r.status === 201 }, tags);
  sleep(0.2);
}
