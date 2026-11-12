import { Fragment } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { ESTADOS_PEDIDO, ETIQUETAS_ESTADO } from '../utils/estados'
import { crearIconoParada, paradasOrdenadas } from '../utils/paradas'
import { ATRIBUCION_OSM, CENTRO_AMBATO, colorDeRuta, URL_TILES_OSM } from './constantesMapa'
import EstadoBadge from './EstadoBadge'

/**
 * Mapa con cada ruta de un color distinto: una línea que une sus paradas en orden de visita y un
 * marcador numerado en cada parada. El color de la ruta i es el mismo que el de su tarjeta en la lista
 * (línea y aro del marcador); el relleno del marcador es el color del estado del pedido, igual que en las
 * tablas. Debajo va la leyenda de esos colores.
 * Si `rutaResaltadaId` es una de las rutas, su línea se engrosa y las demás se atenúan.
 */
export default function MapaRutas({ rutas, altura = 420, rutaResaltadaId = null }) {
  const hayResaltada = rutas.some((ruta) => ruta.id === rutaResaltadaId)
  return (
    <div role="group" aria-label="Mapa de rutas">
      <div className="mapa-marco">
        <MapContainer center={CENTRO_AMBATO} zoom={12} style={{ height: altura }} scrollWheelZoom>
          <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
          {rutas.map((ruta, indice) => {
            const color = colorDeRuta(indice)
            const paradas = paradasOrdenadas(ruta)
            const resaltada = hayResaltada && ruta.id === rutaResaltadaId
            const atenuada = hayResaltada && !resaltada
            return (
              <Fragment key={ruta.id}>
                <Polyline
                  positions={paradas.map(({ pedido }) => [pedido.latitud, pedido.longitud])}
                  pathOptions={{ color, weight: resaltada ? 7 : 3, opacity: atenuada ? 0.3 : 1 }}
                />
                {paradas.map(({ pedido }, posicion) => (
                  <Marker
                    key={pedido.id}
                    position={[pedido.latitud, pedido.longitud]}
                    icon={crearIconoParada(posicion + 1, color, pedido.estado)}
                  >
                    <Popup>
                      Ruta {ruta.id} · parada {posicion + 1}
                      <br />
                      {pedido.direccion}
                      {pedido.estado && (
                        <>
                          <br />
                          <EstadoBadge estado={pedido.estado} />
                        </>
                      )}
                    </Popup>
                  </Marker>
                ))}
              </Fragment>
            )
          })}
        </MapContainer>
      </div>
      <ul className="leyenda-estados" aria-label="Color de cada parada según el estado del pedido">
        {ESTADOS_PEDIDO.map((estado) => (
          <li key={estado} className={`acento-${estado}`}>
            <span className="leyenda-punto" aria-hidden="true" />
            {ETIQUETAS_ESTADO[estado]}
          </li>
        ))}
      </ul>
    </div>
  )
}
