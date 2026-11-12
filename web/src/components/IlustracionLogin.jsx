import { useId } from 'react'

// Calles del mapa estilizado (el mismo trazado sirve para la ruta, que va por ellas).
const CALLES_X = [70, 150, 240, 330, 410]
const CALLES_Y = [60, 130, 200, 270]
const ANCHO = 480
const ALTO = 340

// Manzanas: los huecos entre calles, con un margen para que se vean las avenidas.
const MANZANAS = []
for (let i = 0; i < CALLES_X.length - 1; i += 1) {
  for (let j = 0; j < CALLES_Y.length - 1; j += 1) {
    MANZANAS.push({
      id: `${i}-${j}`,
      x: CALLES_X[i] + 11,
      y: CALLES_Y[j] + 11,
      ancho: CALLES_X[i + 1] - CALLES_X[i] - 22,
      alto: CALLES_Y[j + 1] - CALLES_Y[j] - 22,
      parque: i === 1 && j === 2,
    })
  }
}

// Ruta de reparto por las calles: A (70,270) -> B (150,165) -> C (330,165) -> D (410,60), con esquinas redondeadas.
const RUTA =
  'M70 270V214Q70 200 84 200H136Q150 200 150 186V144Q150 130 164 130H226Q240 130 240 144V186Q240 200 254 200' +
  'H316Q330 200 330 186V144Q330 130 344 130H396Q410 130 410 116V60'

// Río curvo de norte a sur, como el Ambato; los nombres van sobre manzanas libres de la ruta.
const RIO = 'M205-10C205 40 140 70 168 120S292 172 268 232S216 300 244 350'

const SECTORES = [
  { nombre: 'Ficoa', x: 110, y: 98 },
  { nombre: 'Centro', x: 285, y: 168 },
  { nombre: 'Huachi', x: 110, y: 238 },
]

const PINES = [
  { id: 'a', x: 70, y: 270, clase: 'login-pin-a' },
  { id: 'b', x: 150, y: 165, clase: 'login-pin-b' },
  { id: 'c', x: 330, y: 165, clase: 'login-pin-c' },
  { id: 'd', x: 410, y: 60, clase: 'login-pin-d' },
]

// Punta del pin en (0,0): una gota de 28 px de ancho.
const FORMA_PIN = 'M0 0C-10-12-14-18-14-26a14 14 0 1 1 28 0c0 8-4 14-14 26z'

/**
 * Mapa de ciudad estilizado con una ruta punteada que se dibuja uniendo cuatro pines de entrega, y una furgoneta
 * que la recorre. Es decorativo (aria-hidden); la animación es CSS y se apaga con prefers-reduced-motion
 * (ver .login-* en index.css).
 */
export default function IlustracionLogin() {
  const id = useId()
  const idMascara = `${id}-mascara`
  const idRecorte = `${id}-recorte`

  return (
    <svg
      className="login-ilustracion"
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={idRecorte}>
          <rect width={ANCHO} height={ALTO} rx="22" />
        </clipPath>
        {/* La máscara se "dibuja" con stroke-dashoffset y deja ver la ruta punteada poco a poco. */}
        <mask id={idMascara} maskUnits="userSpaceOnUse" x="0" y="0" width={ANCHO} height={ALTO}>
          <path
            className="login-ruta-mascara"
            d={RUTA}
            pathLength="1"
            fill="none"
            stroke="#ffffff"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <g clipPath={`url(#${idRecorte})`}>
        <rect className="login-mapa-fondo" width={ANCHO} height={ALTO} />

        {/* manzanas y parque */}
        {MANZANAS.map((m) => (
          <rect
            key={m.id}
            className={m.parque ? 'login-parque' : 'login-manzana'}
            x={m.x}
            y={m.y}
            width={m.ancho}
            height={m.alto}
            rx="8"
          />
        ))}

        {/* río que cruza la ciudad, como el Ambato: va por debajo de las calles (los cruces son puentes) */}
        <path className="login-rio" d={RIO} fill="none" strokeLinecap="round" />
        <path className="login-rio-brillo" d={RIO} fill="none" strokeLinecap="round" />

        {/* sectores */}
        {SECTORES.map((sector) => (
          <text key={sector.nombre} className="login-sector" x={sector.x} y={sector.y} textAnchor="middle">
            {sector.nombre}
          </text>
        ))}

        {/* calles */}
        <g className="login-calles">
          {CALLES_X.map((x) => (
            <line key={`x${x}`} x1={x} y1="-10" x2={x} y2={ALTO + 10} />
          ))}
          {CALLES_Y.map((y) => (
            <line key={`y${y}`} x1="-10" y1={y} x2={ANCHO + 10} y2={y} />
          ))}
        </g>
      </g>

      {/* ruta: guía tenue siempre visible y trazo punteado que se dibuja encima */}
      <path className="login-ruta-guia" d={RUTA} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path
        className="login-ruta-trazo"
        d={RUTA}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#${idMascara})`}
      />

      {/* pines de entrega */}
      {PINES.map((pin) => (
        <g key={pin.id} transform={`translate(${pin.x} ${pin.y})`}>
          {pin.id === 'd' && <ellipse className="login-pin-onda" cx="0" cy="0" rx="14" ry="6" />}
          <ellipse className="login-pin-sombra" cx="0" cy="1" rx="9" ry="3.2" />
          <g className={`login-pin ${pin.clase}`}>
            <path className="login-pin-cuerpo" d={FORMA_PIN} />
            <circle className={pin.id === 'd' ? 'login-pin-centro login-pin-centro-final' : 'login-pin-centro'} cx="0" cy="-26" r="5.5" />
          </g>
        </g>
      ))}

      {/* furgoneta: una insignia circular que recorre la ruta (offset-path en CSS) */}
      <g className="login-furgoneta" style={{ offsetPath: `path("${RUTA}")`, offsetRotate: '0deg' }}>
        <circle className="login-furgoneta-fondo" r="18" />
        <g className="login-furgoneta-icono" transform="translate(-11.5 -8.5) scale(1.25)">
          <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0H10v10H0z" />
          <path d="M10 3h4.2L18 7v3h-8z" />
          <circle cx="4.5" cy="11" r="2" />
          <circle cx="14" cy="11" r="2" />
        </g>
      </g>
    </svg>
  )
}
