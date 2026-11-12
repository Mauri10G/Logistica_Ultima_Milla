/**
 * La capa GeoJSON de react-leaflet NO se actualiza si cambia `data`, solo si cambia la `key`.
 * Por eso la key incluye el polígono, el nombre y el estado: al editar una zona el mapa la redibuja.
 */
export function claveDeZona(zona) {
  return `${zona.id}:${zona.nombre}:${zona.activa}:${JSON.stringify(zona.area?.coordinates ?? [])}`
}

/**
 * Nombres de las zonas con las que se superpone una zona, tomados del mensaje de ZONA_SUPERPUESTA del backend
 * ("El area se superpone con: Centro, Ingahurco (se cruza, la contiene o queda dentro de ella)…"). Lista vacía si el
 * mensaje no tiene ese formato.
 */
export function zonasSuperpuestas(mensaje) {
  const coincidencia = /se superpone con:\s*(.+?)\s*\(/.exec(mensaje ?? '')
  return coincidencia ? coincidencia[1].split(/,\s*/).filter(Boolean) : []
}
