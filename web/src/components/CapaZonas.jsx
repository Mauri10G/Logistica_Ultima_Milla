import { GeoJSON, Tooltip } from 'react-leaflet'
import { claveDeZona } from '../utils/zonas'
import { colorDeRuta } from './constantesMapa'

/** Dibuja el polígono de cada zona como referencia dentro de un mapa de react-leaflet. */
export default function CapaZonas({ zonas }) {
  return zonas.map((zona, indice) => (
    <GeoJSON
      key={claveDeZona(zona)}
      data={zona.area}
      style={{ color: colorDeRuta(indice), weight: 2, fillOpacity: 0.12, dashArray: '4' }}
    >
      <Tooltip sticky>{zona.nombre}</Tooltip>
    </GeoJSON>
  ))
}
