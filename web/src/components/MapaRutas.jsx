import { Fragment } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { crearIconoParada, paradasOrdenadas } from '../utils/paradas'
import { ATRIBUCION_OSM, CENTRO_AMBATO, colorDeRuta, URL_TILES_OSM } from './constantesMapa'

/**
 * Mapa con cada ruta de un color distinto: una línea que une sus paradas en orden de visita y un
 * marcador numerado en cada parada. El color de la ruta i es el mismo que el de su tarjeta en la lista.
 */
export default function MapaRutas({ rutas, altura = 420 }) {
  return (
    <div role="group" aria-label="Mapa de rutas">
      <MapContainer center={CENTRO_AMBATO} zoom={12} style={{ height: altura }} scrollWheelZoom>
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        {rutas.map((ruta, indice) => {
          const color = colorDeRuta(indice)
          const paradas = paradasOrdenadas(ruta)
          return (
            <Fragment key={ruta.id}>
              <Polyline
                positions={paradas.map(({ pedido }) => [pedido.latitud, pedido.longitud])}
                pathOptions={{ color, weight: 3 }}
              />
              {paradas.map(({ pedido }, posicion) => (
                <Marker
                  key={pedido.id}
                  position={[pedido.latitud, pedido.longitud]}
                  icon={crearIconoParada(posicion + 1, color)}
                >
                  <Popup>
                    Ruta {ruta.id} · parada {posicion + 1}
                    <br />
                    {pedido.direccion}
                  </Popup>
                </Marker>
              ))}
            </Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
