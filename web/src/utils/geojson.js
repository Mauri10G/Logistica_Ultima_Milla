/**
 * Convierte los puntos del mapa ([latitud, longitud]) en un GeoJSON Polygon ([longitud, latitud]),
 * cerrando el anillo (el primer punto se repite al final).
 */
export function puntosAPoligono(puntos) {
  const anillo = puntos.map(([latitud, longitud]) => [longitud, latitud])
  anillo.push(anillo[0])
  return { type: 'Polygon', coordinates: [anillo] }
}

/** Inversa de puntosAPoligono: devuelve los vértices [latitud, longitud] sin el punto de cierre. */
export function poligonoAPuntos(area) {
  const anillo = area?.coordinates?.[0] ?? []
  const abierto = anillo.length > 1 ? anillo.slice(0, -1) : anillo
  return abierto.map(([longitud, latitud]) => [latitud, longitud])
}
