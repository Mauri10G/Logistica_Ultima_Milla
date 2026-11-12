import { useId } from 'react'
import {
  ALTO,
  ANCHO,
  ANCHO_CALLE,
  ANCHO_RIO,
  CALLES_X,
  CALLES_Y,
  MANZANAS,
  PINES,
  RIO,
  RUTA,
  SECTORES,
} from '../utils/mapaLogin'

// Punta del pin en (0,0): una gota de 28 px de ancho.
const FORMA_PIN = 'M0 0C-10-12-14-18-14-26a14 14 0 1 1 28 0c0 8-4 14-14 26z'

// Los puentes son las calles cuando pasan sobre el río: un poco más angostos que la calle y con salientes en las orillas.
const ANCHO_PUENTE = ANCHO_CALLE - 8
const SALIENTE_ORILLA = 5

/**
 * Mapa de ciudad estilizado (con un río, como el Ambato, y los sectores Ficoa, Centro y Huachi) con una ruta
 * punteada que se dibuja uniendo cuatro pines de entrega, y una furgoneta que la recorre. Es decorativo
 * (aria-hidden); la animación es CSS y se apaga con prefers-reduced-motion (ver .login-* en index.css).
 * La geometría (río, manzanas, calles) está en utils/mapaLogin.js.
 */
export default function IlustracionLogin() {
  const id = useId()
  const idMascara = `${id}-mascara`
  const idRecorte = `${id}-recorte`
  const idOrillas = `${id}-orillas`

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
        {/* Solo se ve el tramo de cada calle que cae sobre el agua (más las orillas): ese tramo es el puente. */}
        <mask id={idOrillas} maskUnits="userSpaceOnUse" x="0" y="0" width={ANCHO} height={ALTO}>
          <path
            d={RIO}
            fill="none"
            stroke="#ffffff"
            strokeWidth={ANCHO_RIO + SALIENTE_ORILLA * 2}
            strokeLinecap="butt"
          />
        </mask>
      </defs>

      <g clipPath={`url(#${idRecorte})`}>
        <rect className="login-mapa-fondo" width={ANCHO} height={ALTO} />

        {/* manzanas y parque (las que estaban sobre el río se quitaron) */}
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

        {/* río: por debajo de las calles y de los puentes */}
        <path className="login-rio" d={RIO} fill="none" strokeWidth={ANCHO_RIO} strokeLinecap="butt" />
        <path className="login-rio-brillo" d={RIO} fill="none" strokeLinecap="butt" />

        {/* puentes: franjas de calle recortadas por el río */}
        <g className="login-puentes" mask={`url(#${idOrillas})`}>
          {CALLES_X.map((x) => (
            <rect key={`px${x}`} x={x - ANCHO_PUENTE / 2} y="-10" width={ANCHO_PUENTE} height={ALTO + 20} />
          ))}
          {CALLES_Y.map((y) => (
            <rect key={`py${y}`} x="-10" y={y - ANCHO_PUENTE / 2} width={ANCHO + 20} height={ANCHO_PUENTE} />
          ))}
        </g>

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
          <g className={`login-pin login-pin-${pin.id}`}>
            <path className="login-pin-cuerpo" d={FORMA_PIN} />
            <circle
              className={pin.id === 'd' ? 'login-pin-centro login-pin-centro-final' : 'login-pin-centro'}
              cx="0"
              cy="-26"
              r="5.5"
            />
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
