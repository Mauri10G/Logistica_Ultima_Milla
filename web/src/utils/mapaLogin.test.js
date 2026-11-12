import {
  ALTURA_PIN,
  ANCHO_RIO,
  CALLES_X,
  CALLES_Y,
  DISTANCIA_LIBRE,
  MANZANAS,
  PINES,
  RADIO_PIN,
  RIO,
  SECTORES,
  distanciaAlRio,
  muestrasRio,
} from './mapaLogin'

// Mitad del ancho aproximado de un nombre de sector (11 px con espaciado de letras).
const MEDIO_TEXTO = 25

describe('mapa del login: río y manzanas', () => {
  test('el río es una curva continua que cruza el mapa de arriba abajo', () => {
    const muestras = muestrasRio()

    expect(RIO.startsWith('M')).toBe(true)
    expect(muestras[0][1]).toBeLessThan(0)
    expect(muestras[muestras.length - 1][1]).toBeGreaterThan(340)
  })

  test('ninguna manzana toca el río: todas quedan a más de medio río más el margen', () => {
    const lineaCentral = muestrasRio(80)

    for (const m of MANZANAS) {
      for (const [x, y] of lineaCentral) {
        const dx = Math.max(m.x - x, 0, x - (m.x + m.ancho))
        const dy = Math.max(m.y - y, 0, y - (m.y + m.alto))
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(DISTANCIA_LIBRE - 0.01)
      }
    }
  })

  test('se quitaron las manzanas que estaban en el camino del río, pero quedan varias', () => {
    expect(MANZANAS.length).toBeGreaterThanOrEqual(5)
    expect(MANZANAS.length).toBeLessThan((CALLES_X.length - 1) * (CALLES_Y.length - 1))
  })

  test('los nombres Ficoa, Centro y Huachi quedan sobre manzanas que siguen en el mapa', () => {
    expect(SECTORES.map((s) => s.nombre)).toEqual(['Ficoa', 'Centro', 'Huachi'])

    for (const { nombre, x, y } of SECTORES) {
      const manzana = MANZANAS.find(
        (m) => x - MEDIO_TEXTO >= m.x && x + MEDIO_TEXTO <= m.x + m.ancho && y - 9 >= m.y && y + 3 <= m.y + m.alto,
      )
      expect({ nombre, manzana: Boolean(manzana) }).toEqual({ nombre, manzana: true })
      expect(distanciaAlRio([x, y])).toBeGreaterThan(ANCHO_RIO / 2 + MEDIO_TEXTO)
    }
  })

  test('los pines de entrega no quedan dentro del agua', () => {
    for (const pin of PINES) {
      expect(distanciaAlRio([pin.x, pin.y])).toBeGreaterThan(ANCHO_RIO / 2 + 4)
      expect(distanciaAlRio([pin.x, pin.y - ALTURA_PIN])).toBeGreaterThan(ANCHO_RIO / 2 + RADIO_PIN)
    }
  })
})
