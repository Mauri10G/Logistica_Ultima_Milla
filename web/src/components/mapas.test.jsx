import { act, render, screen } from '@testing-library/react'
import { manejadoresMapa } from 'react-leaflet'
import CapaZonas from './CapaZonas'
import EditorPoligono from './EditorPoligono'
import MapaRutas from './MapaRutas'
import SelectorUbicacion from './SelectorUbicacion'
import { COLORES_RUTA, colorDeRuta } from './constantesMapa'

const ZONAS = [
  { id: 1, nombre: 'Centro', area: { type: 'Polygon', coordinates: [] } },
  { id: 2, nombre: 'Norte', area: { type: 'Polygon', coordinates: [] } },
]

function clic(lat, lng) {
  act(() => manejadoresMapa.actual.click({ latlng: { lat, lng } }))
}

describe('constantesMapa', () => {
  test('colorDeRuta repite la paleta', () => {
    expect(colorDeRuta(0)).toBe(COLORES_RUTA[0])
    expect(colorDeRuta(COLORES_RUTA.length)).toBe(COLORES_RUTA[0])
    expect(colorDeRuta(1)).toBe(COLORES_RUTA[1])
  })
})

describe('CapaZonas', () => {
  test('dibuja un polígono con tooltip por zona', () => {
    render(<CapaZonas zonas={ZONAS} />)

    expect(screen.getAllByTestId('geojson')).toHaveLength(2)
    expect(screen.getByText('Centro')).toBeInTheDocument()
    expect(screen.getByText('Norte')).toBeInTheDocument()
  })
})

describe('SelectorUbicacion', () => {
  test('sin posición no hay marcador y un clic entrega latitud y longitud', () => {
    const onSeleccionar = jest.fn()
    render(<SelectorUbicacion posicion={null} onSeleccionar={onSeleccionar} />)

    expect(screen.queryByTestId('marcador-circulo')).not.toBeInTheDocument()
    clic(-1.24, -78.62)

    expect(onSeleccionar).toHaveBeenCalledWith(-1.24, -78.62)
  })

  test('con posición dibuja el marcador y las zonas de referencia', () => {
    render(<SelectorUbicacion posicion={[-1.24, -78.62]} onSeleccionar={jest.fn()} zonas={ZONAS} />)

    expect(screen.getByTestId('marcador-circulo')).toHaveAttribute('data-center', '[-1.24,-78.62]')
    expect(screen.getAllByTestId('geojson')).toHaveLength(2)
  })
})

describe('EditorPoligono', () => {
  const puntos = [
    [-1.25, -78.62],
    [-1.25, -78.6],
    [-1.27, -78.6],
  ]

  test('mientras está abierto agrega puntos con cada clic y dibuja una línea', () => {
    const onAgregar = jest.fn()
    render(<EditorPoligono puntos={puntos} cerrado={false} onAgregar={onAgregar} />)

    clic(-1.3, -78.5)

    expect(onAgregar).toHaveBeenCalledWith(-1.3, -78.5)
    expect(screen.getByTestId('polilinea')).toBeInTheDocument()
    expect(screen.queryByTestId('poligono')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(3)
  })

  test('cerrado dibuja el polígono y los clics ya no agregan puntos', () => {
    const onAgregar = jest.fn()
    render(<EditorPoligono puntos={puntos} cerrado onAgregar={onAgregar} />)

    clic(-1.3, -78.5)

    expect(onAgregar).not.toHaveBeenCalled()
    expect(screen.getByTestId('poligono')).toBeInTheDocument()
    expect(screen.queryByTestId('polilinea')).not.toBeInTheDocument()
  })

  test('con un solo punto solo hay marcador (sin línea)', () => {
    render(<EditorPoligono puntos={[puntos[0]]} cerrado={false} onAgregar={jest.fn()} />)

    expect(screen.queryByTestId('polilinea')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(1)
  })

  test('muestra las zonas de referencia', () => {
    render(<EditorPoligono puntos={[]} cerrado={false} onAgregar={jest.fn()} zonasReferencia={ZONAS} />)

    expect(screen.getAllByTestId('geojson')).toHaveLength(2)
  })
})

describe('MapaRutas', () => {
  const rutas = [
    {
      id: 10,
      pedidos: [
        { id: 1, latitud: -1.24, longitud: -78.62, direccion: 'Calle A', ordenEnRuta: 1 },
        { id: 2, latitud: -1.25, longitud: -78.61, direccion: 'Calle B', ordenEnRuta: 2 },
      ],
    },
    { id: 11, pedidos: [{ id: 3, latitud: -1.3, longitud: -78.6, direccion: 'Calle C', ordenEnRuta: 1 }] },
  ]

  test('cada ruta tiene una línea de color distinto', () => {
    render(<MapaRutas rutas={rutas} />)

    const lineas = screen.getAllByTestId('polilinea')
    expect(lineas).toHaveLength(2)
    expect(lineas[0]).toHaveAttribute('data-color', COLORES_RUTA[0])
    expect(lineas[1]).toHaveAttribute('data-color', COLORES_RUTA[1])
  })

  test('hay un marcador por parada con su número en el popup', () => {
    render(<MapaRutas rutas={rutas} />)

    expect(screen.getAllByTestId('marcador')).toHaveLength(3)
    expect(screen.getByText(/Ruta 10 · parada 2/)).toBeInTheDocument()
    expect(screen.getByText(/Calle B/)).toBeInTheDocument()
  })

  test('sin rutas solo se ve el mapa', () => {
    render(<MapaRutas rutas={[]} />)

    expect(screen.getByTestId('mapa')).toBeInTheDocument()
    expect(screen.queryByTestId('polilinea')).not.toBeInTheDocument()
  })
})
