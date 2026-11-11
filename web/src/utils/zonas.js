/**
 * La capa GeoJSON de react-leaflet NO se actualiza si cambia `data`, solo si cambia la `key`.
 * Por eso la key incluye el polígono, el nombre y el estado: al editar una zona el mapa la redibuja.
 */
export function claveDeZona(zona) {
  return `${zona.id}:${zona.nombre}:${zona.activa}:${JSON.stringify(zona.area?.coordinates ?? [])}`
}
