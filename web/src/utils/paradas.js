import L from 'leaflet'

/** Marcador redondo del color de la ruta con el número de parada dentro. */
export function crearIconoParada(numero, color) {
  return L.divIcon({
    className: 'parada-marcador',
    html: `<span style="background:${color}">${numero}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

/** Paradas ordenadas por orden de visita (si el backend no manda el orden se respeta el de la lista). */
export function paradasOrdenadas(ruta) {
  return ruta.pedidos
    .map((pedido, indice) => ({ pedido, orden: pedido.ordenEnRuta ?? indice + 1 }))
    .sort((a, b) => a.orden - b.orden)
}
