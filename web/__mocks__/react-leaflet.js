// Mock manual de react-leaflet para Jest: la libreria es ESM y necesita un mapa real, que jsdom no ofrece.
// Cada componente es un <div> con data-testid; useMapEvents guarda los manejadores para que las pruebas
// puedan simular un clic en el mapa con manejadoresMapa.actual.click({ latlng: { lat, lng } }).
import { createElement, useRef } from 'react'

export const manejadoresMapa = { actual: {} }

function contenedor(testid) {
  return function Componente({ children, center, positions, data, pathOptions }) {
    const atributos = { 'data-testid': testid }
    if (center) atributos['data-center'] = JSON.stringify(center)
    if (positions) atributos['data-positions'] = JSON.stringify(positions)
    if (data) atributos['data-data'] = JSON.stringify(data)
    if (pathOptions?.color) atributos['data-color'] = pathOptions.color
    if (pathOptions?.weight) atributos['data-weight'] = pathOptions.weight
    if (pathOptions?.opacity !== undefined) atributos['data-opacity'] = pathOptions.opacity
    return createElement('div', atributos, children)
  }
}

export const MapContainer = contenedor('mapa')
export const TileLayer = () => null

// Igual que react-leaflet real: la capa guarda `data` al crearse y ignora sus cambios posteriores.
// Solo se redibuja si React la vuelve a montar (cambia su `key`).
export function GeoJSON({ children, data, style }) {
  const dataInicial = useRef(data)
  const atributos = { 'data-testid': 'geojson', 'data-data': JSON.stringify(dataInicial.current) }
  if (style?.color) atributos['data-color-zona'] = style.color
  return createElement('div', atributos, children)
}

export const Polyline = contenedor('polilinea')
export const Polygon = contenedor('poligono')
export const CircleMarker = contenedor('marcador-circulo')
export const Marker = contenedor('marcador')
export const Popup = contenedor('popup')
export const Tooltip = contenedor('tooltip')

export function useMapEvents(manejadores) {
  manejadoresMapa.actual = manejadores
  return {}
}
