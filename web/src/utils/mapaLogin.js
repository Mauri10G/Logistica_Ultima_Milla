// Geometría del mapa decorativo de la pantalla de login (components/IlustracionLogin.jsx).
// Está aquí, y no en el componente, para poder comprobar en pruebas que ninguna manzana toca el río y que los
// pines y los nombres de sector quedan fuera del agua.

export const ANCHO = 480
export const ALTO = 340

export const CALLES_X = [70, 150, 240, 330, 410]
export const CALLES_Y = [60, 130, 200, 270]

/** Ancho de las calles y de las manzanas (con margen a cada lado de la línea central de la calle). */
export const ANCHO_CALLE = 22
export const ANCHO_RIO = 16
/** Espacio libre mínimo entre la orilla del río y una manzana. */
export const MARGEN_RIO = 6

// Ruta de reparto por las calles: A (70,270) -> B (150,165) -> C (330,165) -> D (410,60), con esquinas redondeadas.
export const RUTA =
  'M70 270V214Q70 200 84 200H136Q150 200 150 186V144Q150 130 164 130H226Q240 130 240 144V186Q240 200 254 200' +
  'H316Q330 200 330 186V144Q330 130 344 130H396Q410 130 410 116V60'

export const PINES = [
  { id: 'a', x: 70, y: 270 },
  { id: 'b', x: 150, y: 165 },
  { id: 'c', x: 330, y: 165 },
  { id: 'd', x: 410, y: 60 },
]
/** Radio de la cabeza del pin y altura de la punta a su centro (ver FORMA_PIN en el componente). */
export const RADIO_PIN = 14
export const ALTURA_PIN = 26

// Río: línea central que baja en diagonal por la ciudad. Cruza las calles de forma transversal y la ruta lo
// atraviesa solo donde una calle pasa sobre él (puentes).
const PUNTOS_RIO = [
  [204, -12],
  [186, 55],
  [196, 130],
  [240, 168],
  [284, 204],
  [340, 236],
  [372, 282],
  [378, 352],
]

/** Convierte los puntos del río en tramos de Bézier cúbica (Catmull-Rom) para dibujarlo suave. */
function tramosRio(puntos) {
  const tramos = []
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const p0 = puntos[Math.max(i - 1, 0)]
    const p1 = puntos[i]
    const p2 = puntos[i + 1]
    const p3 = puntos[Math.min(i + 2, puntos.length - 1)]
    tramos.push([
      p1,
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2,
    ])
  }
  return tramos
}

const TRAMOS_RIO = tramosRio(PUNTOS_RIO)
const redondear = (n) => Math.round(n * 10) / 10

export const RIO =
  `M${PUNTOS_RIO[0][0]} ${PUNTOS_RIO[0][1]}` +
  TRAMOS_RIO.map(([, c1, c2, fin]) => `C${[...c1, ...c2, ...fin].map(redondear).join(' ')}`).join('')

/** Puntos de la línea central del río, tomados cada pocos píxeles. */
export function muestrasRio(porTramo = 40) {
  const muestras = []
  for (const [p0, p1, p2, p3] of TRAMOS_RIO) {
    for (let i = 0; i <= porTramo; i += 1) {
      const t = i / porTramo
      const u = 1 - t
      muestras.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ])
    }
  }
  return muestras
}

const MUESTRAS_RIO = muestrasRio()

function distanciaARectangulo([px, py], { x, y, ancho, alto }) {
  const dx = Math.max(x - px, 0, px - (x + ancho))
  const dy = Math.max(y - py, 0, py - (y + alto))
  return Math.hypot(dx, dy)
}

/** Distancia de un punto a la línea central del río. */
export function distanciaAlRio(punto) {
  return Math.min(...MUESTRAS_RIO.map(([x, y]) => Math.hypot(x - punto[0], y - punto[1])))
}

/** Distancia mínima de un rectángulo a la línea central del río. */
function distanciaRectanguloAlRio(rect) {
  return Math.min(...MUESTRAS_RIO.map((m) => distanciaARectangulo(m, rect)))
}

/** Distancia a la que una manzana debe estar de la línea central del río para no tocar el agua ni su orilla. */
export const DISTANCIA_LIBRE = ANCHO_RIO / 2 + MARGEN_RIO

// Manzanas: los huecos entre calles. Se quitan las que quedarían sobre el río (o pegadas a él).
const todasLasManzanas = []
for (let i = 0; i < CALLES_X.length - 1; i += 1) {
  for (let j = 0; j < CALLES_Y.length - 1; j += 1) {
    todasLasManzanas.push({
      id: `${i}-${j}`,
      x: CALLES_X[i] + ANCHO_CALLE / 2,
      y: CALLES_Y[j] + ANCHO_CALLE / 2,
      ancho: CALLES_X[i + 1] - CALLES_X[i] - ANCHO_CALLE,
      alto: CALLES_Y[j + 1] - CALLES_Y[j] - ANCHO_CALLE,
      parque: i === 1 && j === 2,
    })
  }
}

export const MANZANAS = todasLasManzanas.filter((m) => distanciaRectanguloAlRio(m) >= DISTANCIA_LIBRE)

// Nombres de sectores: cada uno va centrado sobre una manzana que sigue en el mapa.
export const SECTORES = [
  { nombre: 'Ficoa', x: 110, y: 98 },
  { nombre: 'Centro', x: 285, y: 95 },
  { nombre: 'Huachi', x: 110, y: 238 },
]
