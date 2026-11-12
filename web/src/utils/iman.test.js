import { buscarVerticeCercano, distanciaMetros, RADIO_IMAN_METROS } from './iman'

// Rectángulo de ~1 km de lado: vértices [longitud, latitud] y anillo cerrado.
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

// ~1 grado de latitud = 111 km → 0.0001° ≈ 11 m
const GRADOS_POR_METRO = 1 / 111195

describe('distanciaMetros', () => {
  test('es 0 entre el mismo punto', () => {
    expect(distanciaMetros([-1.25, -78.62], [-1.25, -78.62])).toBe(0)
  })

  test('un grado de latitud son unos 111 km', () => {
    expect(distanciaMetros([0, -78], [1, -78])).toBeCloseTo(111195, -2)
  })
})

describe('buscarVerticeCercano', () => {
  test('el radio por defecto es de 30 m', () => {
    expect(RADIO_IMAN_METROS).toBe(30)
  })

  test('un clic a menos de 30 m de un vértice devuelve ese vértice exacto [latitud, longitud]', () => {
    // ~20 m al norte del vértice (-78.625, -1.2468)
    const resultado = buscarVerticeCercano(-1.2468 + 20 * GRADOS_POR_METRO, -78.625, [CENTRO])

    expect(resultado.punto).toEqual([-1.2468, -78.625])
    expect(resultado.zona).toBe('Centro')
    expect(resultado.distancia).toBeCloseTo(20, 0)
  })

  test('un clic a más de 30 m de todo vértice no se pega', () => {
    // ~40 m del vértice
    expect(buscarVerticeCercano(-1.2468 + 40 * GRADOS_POR_METRO, -78.625, [CENTRO])).toBeNull()
  })

  test('un clic cerca de un borde pero lejos de los vértices no se pega', () => {
    // en medio del borde oeste (lng -78.625), lejos de sus dos vértices
    expect(buscarVerticeCercano(-1.241, -78.625, [CENTRO])).toBeNull()
  })

  test('el límite es estricto: a 30 m exactos no se pega, un poco menos sí', () => {
    expect(buscarVerticeCercano(-1.2468 + 31 * GRADOS_POR_METRO, -78.625, [CENTRO])).toBeNull()
    expect(buscarVerticeCercano(-1.2468 + 29 * GRADOS_POR_METRO, -78.625, [CENTRO])).not.toBeNull()
  })

  test('entre varios vértices cercanos elige el más próximo, de la zona que sea', () => {
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

    const resultado = buscarVerticeCercano(-1.24681, -78.62498, [CENTRO, vecina])

    expect(resultado.zona).toBe('Sur')
    expect(resultado.punto).toEqual([-1.24681, -78.62498])
  })

  test('ignora las zonas inactivas', () => {
    expect(buscarVerticeCercano(-1.2468, -78.625, [{ ...CENTRO, activa: false }])).toBeNull()
  })

  test('sin zonas, o con zonas sin área, no hay vértice', () => {
    expect(buscarVerticeCercano(-1.2468, -78.625, [])).toBeNull()
    expect(buscarVerticeCercano(-1.2468, -78.625, [{ nombre: 'Rota', activa: true }])).toBeNull()
  })

  test('acepta otro radio', () => {
    expect(buscarVerticeCercano(-1.2468 + 40 * GRADOS_POR_METRO, -78.625, [CENTRO], 50)).not.toBeNull()
  })
})
