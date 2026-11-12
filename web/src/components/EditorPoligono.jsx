import { useState } from 'react'
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import { buscarPuntoImantado } from '../utils/iman'
import CapaZonas from './CapaZonas'
import { ATRIBUCION_OSM, CENTRO_AMBATO, URL_TILES_OSM } from './constantesMapa'

const COLOR_NUEVA = '#dc2626'
const COLOR_IMAN = '#16a34a'

/** Clics para agregar puntos y movimiento del mouse para mostrar dónde se pegaría el próximo punto. */
function EscuchaMapa({ onAgregar, onMover, onSalir, activo }) {
  useMapEvents({
    click: (evento) => {
      if (activo) onAgregar(evento.latlng.lat, evento.latlng.lng)
    },
    mousemove: (evento) => {
      if (activo) onMover(evento.latlng.lat, evento.latlng.lng)
    },
    mouseout: onSalir,
  })
  return null
}

/**
 * Mapa para dibujar el polígono de una zona con clics (sin librerías de dibujo).
 * Mientras no está cerrado se ve como una línea con sus vértices; al cerrarlo, como polígono relleno.
 * @param {[number, number][]} puntos vértices [latitud, longitud]
 * @param {boolean} cerrado si está cerrado, los clics ya no agregan puntos
 * Al pasar el mouse muestra un círculo verde donde se pegaría el punto (vértice o borde de otra zona) si hiciera clic.
 * @param {object[]} zonasReferencia otras zonas activas, dibujadas con línea punteada y usadas por el imán
 */
export default function EditorPoligono({ puntos, cerrado, onAgregar, zonasReferencia = [], altura = 420 }) {
  const [vistaPrevia, setVistaPrevia] = useState(null)

  function mover(latitud, longitud) {
    const iman = buscarPuntoImantado(latitud, longitud, zonasReferencia)
    setVistaPrevia((anterior) => {
      if (!iman) return null
      // mismo punto que antes: se conserva el estado para no volver a renderizar en cada movimiento del mouse
      return anterior?.punto[0] === iman.punto[0] && anterior?.punto[1] === iman.punto[1] ? anterior : iman
    })
  }

  return (
    <fieldset className="conjunto" aria-label="Mapa para dibujar el polígono de la zona">
      <MapContainer center={CENTRO_AMBATO} zoom={13} style={{ height: altura }} scrollWheelZoom>
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <CapaZonas zonas={zonasReferencia} />
        <EscuchaMapa onAgregar={onAgregar} onMover={mover} onSalir={() => setVistaPrevia(null)} activo={!cerrado} />
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
        {!cerrado && vistaPrevia && (
          <CircleMarker
            center={vistaPrevia.punto}
            radius={9}
            interactive={false}
            pathOptions={{ color: COLOR_IMAN, fillColor: COLOR_IMAN, fillOpacity: 0.35, weight: 3 }}
          >
            <Tooltip permanent direction="top">
              {vistaPrevia.tipo === 'vertice' ? 'Vértice' : 'Borde'} de {vistaPrevia.zona}
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </fieldset>
  )
}
