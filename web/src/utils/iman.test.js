import { buscarPuntoImantado, distanciaMetros, puntoMasCercanoEnSegmento, RADIO_IMAN_METROS } from './iman'

// Cuadrilátero de ~2 km: vértices [longitud, latitud] y anillo cerrado.
const CENTRO = {
  id: 1,
  nombre: 'Centro',
  activa: true,
  area: {
    type: 'Polygon',
    coordinates: [
      [
        [-78.625, -1.2468],
        [-78.605, -1.2474],
        [-78.605, -1.2346],
        [-78.625, -1.2354],
        [-78.625, -1.2468],
      ],
    ],
  },
}

// ~1 grado de latitud = 111 km
const GRADOS_POR_METRO = 1 / 111195
const m = (metros) => metros * GRADOS_POR_METRO

describe('distanciaMetros', () => {
  test('es 0 entre el mismo punto', () => {
    expect(distanciaMetros([-1.25, -78.62], [-1.25, -78.62])).toBe(0)
  })

  test('un grado de latitud son unos 111 km', () => {
    expect(distanciaMetros([0, -78], [1, -78])).toBeCloseTo(111195, -2)
  })
})

describe('puntoMasCercanoEnSegmento', () => {
  const A = [-78.625, -1.2468]
  const B = [-78.625, -1.2354] // segmento vertical (misma longitud)

  test('proyecta el punto sobre el segmento: [latitud, longitud]', () => {
    expect(puntoMasCercanoEnSegmento(-1.24, -78.62, A, B)).toEqual([-1.24, -78.625])
  })

  test('antes del inicio y después del final se limita al extremo', () => {
    expect(puntoMasCercanoEnSegmento(-1.3, -78.62, A, B)).toEqual([-1.2468, -78.625])
    expect(puntoMasCercanoEnSegmento(-1.2, -78.62, A, B)).toEqual([-1.2354, -78.625])
  })

  test('un segmento de largo 0 devuelve su único punto', () => {
    expect(puntoMasCercanoEnSegmento(-1.2, -78.6, A, A)).toEqual([-1.2468, -78.625])
  })

  test('en un segmento oblicuo el resultado queda sobre la recta', () => {
    const inicio = [-78.625, -1.2354]
    const fin = [-78.605, -1.2346]
    const [lat, lng] = puntoMasCercanoEnSegmento(-1.235 + m(50), -78.615, inicio, fin)

    const producto = (fin[0] - inicio[0]) * (lat - inicio[1]) - (fin[1] - inicio[1]) * (lng - inicio[0])
    expect(Math.abs(producto)).toBeLessThan(1e-12)
    expect(lng).toBeGreaterThan(inicio[0])
    expect(lng).toBeLessThan(fin[0])
  })
})

describe('buscarPuntoImantado', () => {
  test('el radio por defecto es de 100 m', () => {
    expect(RADIO_IMAN_METROS).toBe(100)
  })

  test('un clic a menos de 100 m de un vértice devuelve ese vértice exacto [latitud, longitud]', () => {
    const resultado = buscarPuntoImantado(-1.2468 + m(80), -78.625, [CENTRO])

    expect(resultado).toMatchObject({ punto: [-1.2468, -78.625], zona: 'Centro', tipo: 'vertice' })
    expect(resultado.distancia).toBeCloseTo(80, 0)
  })

  test('el vértice tiene prioridad aunque haya un borde más cerca', () => {
    // 30 m al este del borde oeste (lng -78.625) y a ~58 m del vértice sur: ambos dentro del radio
    const resultado = buscarPuntoImantado(-1.2468 + m(50), -78.625 + m(30), [CENTRO])

    expect(resultado.tipo).toBe('vertice')
    expect(resultado.punto).toEqual([-1.2468, -78.625])
  })

  test('sin vértices cerca, se pega al punto más cercano del borde', () => {
    // en medio del borde oeste (lat -1.2411), 50 m hacia afuera (al oeste): vértices a más de 600 m
    const latitud = -1.2411
    const resultado = buscarPuntoImantado(latitud, -78.625 - m(50), [CENTRO])

    expect(resultado.tipo).toBe('borde')
    expect(resultado.zona).toBe('Centro')
    expect(resultado.punto[0]).toBeCloseTo(latitud, 9)
    expect(resultado.punto[1]).toBeCloseTo(-78.625, 9)
    expect(resultado.distancia).toBeCloseTo(50, 0)
  })

  test('un clic dentro de la zona, cerca de su borde, también se pega al borde', () => {
    const resultado = buscarPuntoImantado(-1.2411, -78.625 + m(60), [CENTRO])

    expect(resultado.tipo).toBe('borde')
    expect(resultado.punto[1]).toBeCloseTo(-78.625, 9)
  })

  test('a más de 100 m de todo vértice y todo borde no se pega', () => {
    expect(buscarPuntoImantado(-1.2411, -78.625 - m(150), [CENTRO])).toBeNull()
    expect(buscarPuntoImantado(-1.2468 - m(150), -78.625, [CENTRO])).toBeNull()
  })

  test('el límite es estricto: 99 m sí se pega y 101 m no (vértice y borde)', () => {
    expect(buscarPuntoImantado(-1.2468 - m(99), -78.625, [CENTRO]).tipo).toBe('vertice')
    expect(buscarPuntoImantado(-1.2468 - m(101), -78.625, [CENTRO])).toBeNull()
    expect(buscarPuntoImantado(-1.2411, -78.625 - m(99), [CENTRO]).tipo).toBe('borde')
    expect(buscarPuntoImantado(-1.2411, -78.625 - m(101), [CENTRO])).toBeNull()
  })

  test('entre varias zonas elige el vértice más próximo, de la zona que sea', () => {
    const vecina = {
      nombre: 'Sur',
      activa: true,
      area: {
        type: 'Polygon',
        coordinates: [
          [
            [-78.62498, -1.24681], // ~2 m del vértice de Centro, más cerca del clic
            [-78.6, -1.25],
            [-78.6, -1.26],
            [-78.62498, -1.24681],
          ],
        ],
      },
    }

    const resultado = buscarPuntoImantado(-1.24681, -78.62498, [CENTRO, vecina])

    expect(resultado.zona).toBe('Sur')
    expect(resultado.punto).toEqual([-1.24681, -78.62498])
  })

  test('entre varios bordes elige el más cercano, de la zona que sea', () => {
    const vecina = {
      nombre: 'Oeste',
      activa: true,
      area: {
        type: 'Polygon',
        coordinates: [
          [
            [-78.6275, -1.2468],
            [-78.6275, -1.2354],
            [-78.64, -1.2354],
            [-78.64, -1.2468],
            [-78.6275, -1.2468],
          ],
        ],
      },
    }
    // entre los dos bordes (lng -78.6275 y -78.625), a ~10 m del de «Oeste» y a ~15 m del de «Centro»
    const resultado = buscarPuntoImantado(-1.2411, -78.6275 + m(10), [CENTRO, vecina])

    expect(resultado.zona).toBe('Oeste')
    expect(resultado.tipo).toBe('borde')
  })

  test('ignora las zonas inactivas', () => {
    expect(buscarPuntoImantado(-1.2468, -78.625, [{ ...CENTRO, activa: false }])).toBeNull()
  })

  test('sin zonas, o con zonas sin área, no hay dónde pegarse', () => {
    expect(buscarPuntoImantado(-1.2468, -78.625, [])).toBeNull()
    expect(buscarPuntoImantado(-1.2468, -78.625, [{ nombre: 'Rota', activa: true }])).toBeNull()
  })

  test('acepta otro radio', () => {
    expect(buscarPuntoImantado(-1.2468 - m(150), -78.625, [CENTRO], 200)).not.toBeNull()
    expect(buscarPuntoImantado(-1.2468 - m(80), -78.625, [CENTRO], 50)).toBeNull()
  })
})
