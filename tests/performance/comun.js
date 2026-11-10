// Utilidades compartidas por los scripts k6.
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

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

export function puntoAleatorio() {
  const zona = ZONAS[Math.floor(Math.random() * ZONAS.length)];
  const [minLng, minLat, maxLng, maxLat] = zona.caja;
  return { latitud: aleatorio(minLat, maxLat), longitud: aleatorio(minLng, maxLng) };
}

/** YYYY-MM-DD de hoy + dias (la API rechaza fechas anteriores a hoy). */
export function fechaIso(dias) {
  const fecha = new Date(Date.now() + dias * 24 * 3600 * 1000);
  return fecha.toISOString().slice(0, 10);
}

export function cuerpoPedido(fechaEntrega) {
  const { latitud, longitud } = puntoAleatorio();
  const hora = String(Math.floor(aleatorio(8, 21))).padStart(2, '0');
  return JSON.stringify({
    clienteNombres: `Cliente k6 ${__VU}-${__ITER}`,
    clienteTelefono: '0990000000',
    direccion: `Direccion k6 ${__VU}-${__ITER}`,
    latitud,
    longitud,
    fechaEntrega,
    horaEntrega: `${hora}:00`,
    prioridad: Math.random() < 0.2 ? 'ALTA' : 'NORMAL',
  });
}

export const CABECERAS_JSON = { headers: { 'Content-Type': 'application/json' } };
