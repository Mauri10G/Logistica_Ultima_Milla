import { GeoJSON, Tooltip } from 'react-leaflet'
import { claveDeZona } from '../utils/zonas'
import { colorDeZona } from './constantesMapa'

/** Dibuja el polígono de cada zona como referencia dentro de un mapa de react-leaflet, con el color de la zona. */
export default function CapaZonas({ zonas }) {
  return zonas.map((zona) => (
    <GeoJSON
      key={claveDeZona(zona)}
      data={zona.area}
      style={{ color: colorDeZona(zona), weight: 2, fillOpacity: 0.12, dashArray: '4' }}
    >
      <Tooltip sticky>{zona.nombre}</Tooltip>
    </GeoJSON>
  ))
}
