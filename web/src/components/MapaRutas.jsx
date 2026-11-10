import { Fragment } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import { CENTRO_AMBATO, COLORES_RUTA } from './constantesMapa'

/** Mapa con cada ruta como una linea que une sus paradas en orden de visita. */
export default function MapaRutas({ rutas, altura = 420 }) {
  return (
    <MapContainer center={CENTRO_AMBATO} zoom={12} style={{ height: altura }} scrollWheelZoom>
      <TileLayer
        attribution="&copy; colaboradores de OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {rutas.map((ruta, indice) => {
        const color = COLORES_RUTA[indice % COLORES_RUTA.length]
        const puntos = ruta.pedidos.map((pedido) => [pedido.latitud, pedido.longitud])
        return (
          <Fragment key={ruta.id}>
            <Polyline positions={puntos} pathOptions={{ color, weight: 3 }} />
            {ruta.pedidos.map((pedido) => (
              <CircleMarker
                key={pedido.id}
                center={[pedido.latitud, pedido.longitud]}
                radius={7}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.9 }}
              >
                <Popup>
                  Ruta {ruta.id} · parada {pedido.ordenEnRuta}
                  <br />
                  {pedido.direccion}
                </Popup>
              </CircleMarker>
            ))}
          </Fragment>
        )
      })}
    </MapContainer>
  )
}
