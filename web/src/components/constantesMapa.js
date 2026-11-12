/** Centro de Ambato [latitud, longitud]. */
export const CENTRO_AMBATO = [-1.2491, -78.6167]

export const COLORES_RUTA = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#be185d']

/** Color estable para el elemento `indice` de una lista (se repite al agotar la paleta). */
export function colorDeRuta(indice) {
  return COLORES_RUTA[indice % COLORES_RUTA.length]
}

export const ATRIBUCION_OSM = '&copy; colaboradores de OpenStreetMap'
export const URL_TILES_OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Color de una zona: sale de su id, así no cambia cuando se agregan, se editan o se ocultan otras zonas. */
export function colorDeZona(zona) {
  return colorDeRuta(Number(zona.id))
}
