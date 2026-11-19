// Utilidades compartidas por los scripts k6.
import http from 'k6/http';
import { fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Usuario con el que se hace login (ver docs/api-auth.md). Por defecto el personal del negocio (STAFF).
const API_USUARIO = __ENV.API_USUARIO || 'staff';
const API_CLAVE = __ENV.API_CLAVE || 'staff123';

/**
 * Hace login en POST /api/auth/login y devuelve el token. Se llama una sola vez, desde setup() de cada script.
 * Si el login falla se corta la prueba con un mensaje claro, para no medir miles de 401.
 * Con la seguridad apagada el login igual responde y el token simplemente se ignora.
 */
export function iniciarSesion() {
  const respuesta = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ usuario: API_USUARIO, clave: API_CLAVE }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );
  if (respuesta.status !== 200) {
    fail(`Login fallido para ${API_USUARIO}: HTTP ${respuesta.status} ${String(respuesta.body).slice(0, 120)}`);
  }
  const token = respuesta.json('token');
  if (!token) fail('El login no devolvio un token');
  return token;
}

/** Parametros de una peticion con el token y JSON. `extra` permite agregar tags u otras opciones de k6. */
export function conToken(token, extra = {}) {
  return {
    ...extra,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(extra.headers || {}) },
  };
}

// Rectangulos (minLng, minLat, maxLng, maxLat) dentro de cada zona de los datos base (V2__datos_base.sql).
// Si cambian las zonas, hay que ajustarlos.
const ZONAS = [
  { nombre: 'Centro', caja: [-78.6235, -1.2455, -78.6105, -1.2365] },
  { nombre: 'Ingahurco', caja: [-78.6235, -1.2335, -78.6105, -1.2245] },
  { nombre: 'Ficoa/Atocha', caja: [-78.6415, -1.2335, -78.6265, -1.2185] },
  { nombre: 'Norte/Izamba', caja: [-78.6195, -1.2215, -78.5905, -1.2025] },
  { nombre: 'Sur/Huachi', caja: [-78.6295, -1.2675, -78.6055, -1.2485] },
];

export function aleatorio(min, max) {
  return min + Math.random() * (max - min);
}

/** Punto al azar dentro de la zona indicada por nombre, o de una zona al azar si no se indica. */
export function puntoAleatorio(nombreZona) {
  const zona = nombreZona
    ? ZONAS.find((z) => z.nombre === nombreZona)
    : ZONAS[Math.floor(Math.random() * ZONAS.length)];
  if (!zona) throw new Error(`Zona desconocida en comun.js: ${nombreZona}`);
  const [minLng, minLat, maxLng, maxLat] = zona.caja;
  return { latitud: aleatorio(minLat, maxLat), longitud: aleatorio(minLng, maxLng) };
}

/** YYYY-MM-DD de hoy + dias (la API rechaza fechas anteriores a hoy). */
export function fechaIso(dias) {
  const fecha = new Date(Date.now() + dias * 24 * 3600 * 1000);
  return fecha.toISOString().slice(0, 10);
}

/** Cuerpo de POST /api/pedidos. `nombreZona` (opcional) concentra el pedido en una zona. */
export function cuerpoPedido(fechaEntrega, nombreZona) {
  const { latitud, longitud } = puntoAleatorio(nombreZona);
  const hora = String(Math.floor(aleatorio(8, 21))).padStart(2, '0');
  // En setup() no existen __VU ni __ITER.
  const id = typeof __ITER === 'undefined' ? `setup-${Date.now() % 100000}` : `${__VU}-${__ITER}`;
  return JSON.stringify({
    clienteNombres: `Cliente k6 ${id}`,
    clienteTelefono: '0990000000',
    direccion: `Direccion k6 ${id}`,
    latitud,
    longitud,
    fechaEntrega,
    horaEntrega: `${hora}:00`,
    prioridad: Math.random() < 0.2 ? 'ALTA' : 'NORMAL',
  });
}
