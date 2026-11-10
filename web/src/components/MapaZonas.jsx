import { GeoJSON, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { CENTRO_AMBATO, COLORES_RUTA } from './constantesMapa'


/** Mapa centrado en Ambato con el poligono de cada zona. */
export default function MapaZonas({ zonas, altura = 420 }) {
  return (
    <MapContainer center={CENTRO_AMBATO} zoom={12} style={{ height: altura }} scrollWheelZoom>
      <TileLayer
        attribution="&copy; colaboradores de OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {zonas.map((zona, indice) => (
        <GeoJSON
          key={zona.id}
          data={zona.area}
          style={{ color: COLORES_RUTA[indice % COLORES_RUTA.length], weight: 2, fillOpacity: 0.15 }}
        >
          <Tooltip sticky>{zona.nombre}</Tooltip>
        </GeoJSON>
      ))}
    </MapContainer>
  )
}
