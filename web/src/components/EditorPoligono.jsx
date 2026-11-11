import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import CapaZonas from './CapaZonas'
import { ATRIBUCION_OSM, CENTRO_AMBATO, URL_TILES_OSM } from './constantesMapa'

const COLOR_NUEVA = '#dc2626'

function EscuchaClics({ onAgregar, activo }) {
  useMapEvents({
    click: (evento) => {
      if (activo) onAgregar(evento.latlng.lat, evento.latlng.lng)
    },
  })
  return null
}

/**
 * Mapa para dibujar el polígono de una zona con clics (sin librerías de dibujo).
 * Mientras no está cerrado se ve como una línea con sus vértices; al cerrarlo, como polígono relleno.
 * @param {[number, number][]} puntos vértices [latitud, longitud]
 * @param {boolean} cerrado si está cerrado, los clics ya no agregan puntos
 * @param {object[]} zonasReferencia otras zonas, dibujadas con línea punteada
 */
export default function EditorPoligono({ puntos, cerrado, onAgregar, zonasReferencia = [], altura = 420 }) {
  return (
    <div role="group" aria-label="Mapa para dibujar el polígono de la zona">
      <MapContainer center={CENTRO_AMBATO} zoom={13} style={{ height: altura }} scrollWheelZoom>
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <CapaZonas zonas={zonasReferencia} />
        <EscuchaClics onAgregar={onAgregar} activo={!cerrado} />
        {cerrado && puntos.length >= 3 && (
          <Polygon positions={puntos} pathOptions={{ color: COLOR_NUEVA, weight: 3, fillOpacity: 0.25 }} />
        )}
        {!cerrado && puntos.length >= 2 && <Polyline positions={puntos} pathOptions={{ color: COLOR_NUEVA, weight: 3 }} />}
        {puntos.map((punto, indice) => (
          <CircleMarker
            key={`${indice}-${punto[0]}-${punto[1]}`}
            center={punto}
            radius={5}
            pathOptions={{ color: COLOR_NUEVA, fillColor: '#fff', fillOpacity: 1 }}
          />
        ))}
      </MapContainer>
    </div>
  )
}
