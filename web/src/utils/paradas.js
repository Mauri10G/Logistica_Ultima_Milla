import L from 'leaflet'

/**
 * Marcador redondo con el número de parada. El aro es del color de la ruta; si se indica el `estado` del pedido,
 * el relleno toma el color de ese estado (las mismas variables CSS de las tablas y los badges). Sin estado,
 * el relleno es del color de la ruta.
 */
export function crearIconoParada(numero, color, estado) {
  const clase = estado ? ` class="parada-${estado}"` : ''
  return L.divIcon({
    className: 'parada-marcador',
    html: `<span${clase} style="--ruta:${color}">${numero}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

/** Paradas ordenadas por orden de visita (si el backend no manda el orden se respeta el de la lista). */
export function paradasOrdenadas(ruta) {
  return ruta.pedidos
    .map((pedido, indice) => ({ pedido, orden: pedido.ordenEnRuta ?? indice + 1 }))
    .sort((a, b) => a.orden - b.orden)
}
