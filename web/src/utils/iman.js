/**
 * Radio del efecto imán, en metros. Un clic (o el mouse) a menos de esta distancia de un vértice o de un borde de
 * otra zona activa se pega a él. Para cambiarlo basta con editar este valor; `buscarPuntoImantado` también acepta
 * otro radio como parámetro.
 */
export const RADIO_IMAN_METROS = 100

const RADIO_TIERRA_METROS = 6371000
const aRadianes = (grados) => (grados * Math.PI) / 180

/** Distancia haversine en metros entre dos puntos [latitud, longitud]. */
export function distanciaMetros([latitudA, longitudA], [latitudB, longitudB]) {
  const dLat = aRadianes(latitudB - latitudA)
  const dLng = aRadianes(longitudB - longitudA)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(latitudA)) * Math.cos(aRadianes(latitudB)) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Punto más cercano a (latitud, longitud) sobre el segmento A-B ([longitud, latitud] cada extremo, como GeoJSON).
 * Proyecta en un plano local (metros) alrededor del punto, suficiente a escala de ciudad, y limita el resultado
 * al segmento. Devuelve [latitud, longitud].
 */
export function puntoMasCercanoEnSegmento(latitud, longitud, [lngA, latA], [lngB, latB]) {
  const escalaLng = Math.cos(aRadianes(latitud))
  const ax = (lngA - longitud) * escalaLng
  const ay = latA - latitud
  const dx = (lngB - lngA) * escalaLng
  const dy = latB - latA
  const largo2 = dx * dx + dy * dy
  if (largo2 === 0) return [latA, lngA]
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo2))
  return [latA + t * (latB - latA), lngA + t * (lngB - lngA)]
}

/**
 * Efecto imán para dibujar zonas pegadas, sin huecos: busca dónde se pegaría un punto.
 *
 * 1. Prioridad al VÉRTICE: si hay vértices de zonas activas a menos de `radio` metros, devuelve el más cercano
 *    (exacto, sin redondear, así dos zonas vecinas comparten el mismo vértice).
 * 2. Si no hay ninguno, devuelve el punto más cercano sobre cualquier BORDE de esas zonas, si está a menos de
 *    `radio` metros. Ese punto puede diferir del borde del vecino por decimales; el backend tolera esa franja
 *    (logistica.zonas.tolerancia-superposicion-m2).
 * 3. Si tampoco hay borde cerca, devuelve null y el punto queda donde se hizo clic.
 *
 * @param {number} latitud latitud del clic o del mouse
 * @param {number} longitud longitud del clic o del mouse
 * @param {object[]} zonas zonas del backend ({ nombre, activa, area: GeoJSON Polygon [longitud, latitud] })
 * @param {number} [radio] radio en metros
 * @returns {{ punto: [number, number], zona: string, distancia: number, tipo: 'vertice' | 'borde' } | null}
 *   `punto` es [latitud, longitud]
 */
export function buscarPuntoImantado(latitud, longitud, zonas, radio = RADIO_IMAN_METROS) {
  const clic = [latitud, longitud]
  let vertice = null
  let borde = null
  for (const zona of zonas) {
    if (zona.activa === false) continue
    for (const anillo of zona.area?.coordinates ?? []) {
      // el último punto de un anillo repite al primero: los vértices se cuentan una sola vez
      for (const [lng, lat] of anillo.slice(0, -1)) {
        const distancia = distanciaMetros(clic, [lat, lng])
        if (distancia < radio && (vertice === null || distancia < vertice.distancia)) {
          vertice = { punto: [lat, lng], zona: zona.nombre, distancia, tipo: 'vertice' }
        }
      }
      for (let i = 0; i < anillo.length - 1; i += 1) {
        const punto = puntoMasCercanoEnSegmento(latitud, longitud, anillo[i], anillo[i + 1])
        const distancia = distanciaMetros(clic, punto)
        if (distancia < radio && (borde === null || distancia < borde.distancia)) {
          borde = { punto, zona: zona.nombre, distancia, tipo: 'borde' }
        }
      }
    }
  }
  return vertice ?? borde
}
