import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import CapaZonas from './CapaZonas'
import { ATRIBUCION_OSM, CENTRO_AMBATO, URL_TILES_OSM } from './constantesMapa'

function EscuchaClics({ onSeleccionar }) {
  useMapEvents({
    click: (evento) => onSeleccionar(evento.latlng.lat, evento.latlng.lng),
  })
  return null
}

/**
 * Mapa centrado en Ambato: un clic coloca el marcador de entrega y entrega latitud y longitud.
 * Muestra las zonas activas como referencia.
 * @param {[number, number] | null} posicion [latitud, longitud] del marcador actual
 */
export default function SelectorUbicacion({ posicion, onSeleccionar, zonas = [], altura = 320 }) {
  return (
    <div role="group" aria-label="Mapa para elegir la ubicación de entrega">
      <MapContainer center={posicion ?? CENTRO_AMBATO} zoom={13} style={{ height: altura }} scrollWheelZoom>
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <CapaZonas zonas={zonas} />
        <EscuchaClics onSeleccionar={onSeleccionar} />
        {posicion && (
          <CircleMarker
            center={posicion}
            radius={9}
            pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.9 }}
          />
        )}
      </MapContainer>
    </div>
  )
}
