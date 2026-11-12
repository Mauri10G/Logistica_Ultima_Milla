/** Radio del efecto imán: un clic a menos de esta distancia de un vértice ajeno se pega a ese vértice. */
export const RADIO_IMAN_METROS = 30

const RADIO_TIERRA_METROS = 6371000

/** Distancia haversine en metros entre dos puntos [latitud, longitud]. */
export function distanciaMetros([latitudA, longitudA], [latitudB, longitudB]) {
  const aRadianes = (grados) => (grados * Math.PI) / 180
  const dLat = aRadianes(latitudB - latitudA)
  const dLng = aRadianes(longitudB - longitudA)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(latitudA)) * Math.cos(aRadianes(latitudB)) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Efecto imán para dibujar zonas contiguas: busca, entre los vértices de las zonas activas dadas, el más cercano
 * al clic. Si está a menos de `radio` metros devuelve ese vértice EXACTO (sin redondear), para que dos zonas vecinas
 * compartan el mismo vértice y el backend vea un borde común y no una superposición.
 *
 * @param {number} latitud latitud del clic
 * @param {number} longitud longitud del clic
 * @param {object[]} zonas zonas del backend ({ nombre, activa, area: GeoJSON Polygon [longitud, latitud] })
 * @param {number} [radio] radio en metros
 * @returns {{ punto: [number, number], zona: string, distancia: number } | null} punto [latitud, longitud]
 */
export function buscarVerticeCercano(latitud, longitud, zonas, radio = RADIO_IMAN_METROS) {
  let mejor = null
  for (const zona of zonas) {
    if (zona.activa === false) continue
    for (const anillo of zona.area?.coordinates ?? []) {
      // el último punto de un anillo repite al primero: se ignora para no contar el vértice dos veces
      for (const [lng, lat] of anillo.slice(0, -1)) {
        const distancia = distanciaMetros([latitud, longitud], [lat, lng])
        if (distancia < radio && (mejor === null || distancia < mejor.distancia)) {
          mejor = { punto: [lat, lng], zona: zona.nombre, distancia }
        }
      }
    }
  }
  return mejor
}
