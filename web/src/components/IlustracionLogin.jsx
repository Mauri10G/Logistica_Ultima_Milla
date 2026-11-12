import { useId } from 'react'

// Postal de Ambato vista de frente, dibujada en SVG: cielo, volcán Tungurahua, colinas, la ciudad con la Catedral,
// árboles y flores, la calle con la furgoneta de entregas y tres pines de entrega sobre las casas.
// Es decorativa (aria-hidden). Las animaciones son CSS y se apagan con prefers-reduced-motion (ver .login-* en index.css).

const ANCHO = 600
const ALTO = 440
/** Línea del suelo donde se apoya la ciudad (arriba de la vereda). */
const SUELO = 352

const PINTURA = {
  ventana: '#2b4aa8',
  luz: '#ffb347',
  puerta: ['#c9482f', '#2851d8', '#8a5a3c'],
  flores: ['#ff7a59', '#ff6fa5', '#ffc24d', '#ffffff', '#ff9fc4'],
}

// Edificios de la fila de atrás: siluetas más claras que dan profundidad.
const FONDO_CIUDAD = [
  { x: 20, w: 36, h: 66 }, { x: 96, w: 30, h: 80 }, { x: 150, w: 40, h: 58 }, { x: 206, w: 30, h: 72 },
  { x: 404, w: 34, h: 70 }, { x: 456, w: 30, h: 56 }, { x: 512, w: 38, h: 76 }, { x: 560, w: 34, h: 60 },
]

// Casas y edificios de la fila de adelante. 'dos-aguas' lleva techo de tejas; 'plano' lleva parapeto.
const EDIFICIOS = [
  { x: -6, w: 52, h: 58, color: '#ffe3b8', techo: 'dos-aguas', colorTecho: '#e0693f' },
  { x: 46, w: 40, h: 84, color: '#d9e5ff', techo: 'plano' },
  { x: 86, w: 50, h: 62, color: '#ffd1c4', techo: 'dos-aguas', colorTecho: '#c9482f' },
  { x: 136, w: 44, h: 96, color: '#fff5e4', techo: 'plano' },
  { x: 180, w: 50, h: 60, color: '#c7ece4', techo: 'dos-aguas', colorTecho: '#e0693f' },
  { x: 398, w: 46, h: 90, color: '#d9e5ff', techo: 'plano' },
  { x: 444, w: 48, h: 60, color: '#ffe3b8', techo: 'dos-aguas', colorTecho: '#c9482f' },
  { x: 492, w: 42, h: 78, color: '#ffd1c4', techo: 'plano' },
  { x: 534, w: 72, h: 56, color: '#fff5e4', techo: 'dos-aguas', colorTecho: '#e0693f' },
]

// Pines de entrega: sobre el techo de tres casas (la punta del pin toca el vértice del techo).
const PINES = [
  { x: 111, y: SUELO - 62 - 18 },
  { x: 205, y: SUELO - 60 - 18 },
  { x: 468, y: SUELO - 60 - 18 },
]

const ARBOLES = [
  { x: 34, escala: 1, fruto: '#ff8a3d' },
  { x: 134, escala: 1.15, fruto: '#ff9fc4' },
  { x: 222, escala: 0.95, fruto: '#ff8a3d' },
  { x: 410, escala: 1, fruto: '#ff9fc4' },
  { x: 512, escala: 1.2, fruto: '#ff8a3d' },
  { x: 580, escala: 0.9, fruto: '#ff9fc4' },
]

const PARTERRES = [76, 178, 262, 336, 446, 548]

const NUBES = [
  { x: 150, y: 112, escala: 1, clase: 'login-nube-1' },
  { x: 330, y: 58, escala: 0.8, clase: 'login-nube-2' },
  { x: 520, y: 40, escala: 0.65, clase: 'login-nube-3' },
]

// Punta del pin en (0,0): una gota de 28 px de ancho.
const FORMA_PIN = 'M0 0C-10-12-14-18-14-26a14 14 0 1 1 28 0c0 8-4 14-14 26z'

function Nube({ x, y, escala, clase }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <g className={`login-nube ${clase}`}>
        <ellipse cx="35" cy="0" rx="40" ry="10" />
        <circle cx="18" cy="-8" r="13" />
        <circle cx="40" cy="-15" r="17" />
        <circle cx="62" cy="-6" r="12" />
      </g>
    </g>
  )
}

function Edificio({ x, w, h, color, techo, colorTecho, indice }) {
  const arriba = SUELO - h
  const columnas = Math.max(1, Math.floor((w - 8) / 13))
  const filas = Math.max(1, Math.floor((h - 28) / 19))
  const celda = (w - 8) / columnas
  const ventanas = []
  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      ventanas.push({
        clave: `${f}-${c}`,
        x: x + 4 + c * celda + (celda - 7) / 2,
        y: arriba + 9 + f * 19,
        luz: (indice + f * 2 + c) % 3 === 0,
      })
    }
  }
  return (
    <g>
      <rect x={x} y={arriba} width={w} height={h} fill={color} />
      <rect x={x + w - 6} y={arriba} width="6" height={h} fill="#10206b" opacity="0.08" />
      {techo === 'dos-aguas' ? (
        <>
          <polygon points={`${x - 3},${arriba} ${x + w + 3},${arriba} ${x + w / 2},${arriba - 18}`} fill={colorTecho} />
          <polygon points={`${x + w / 2},${arriba - 18} ${x + w + 3},${arriba} ${x + w / 2},${arriba}`} fill="#10206b" opacity="0.14" />
        </>
      ) : (
        <>
          <rect x={x - 2} y={arriba - 4} width={w + 4} height="5" fill="#8497d6" />
          {w > 40 && <rect x={x + w - 14} y={arriba - 12} width="8" height="8" fill="#8497d6" />}
        </>
      )}
      {ventanas.map((v) => (
        <rect key={v.clave} className={v.luz ? 'login-ventana-luz' : 'login-ventana'} x={v.x} y={v.y} width="7" height="10" rx="1.5" />
      ))}
      <rect x={x + w / 2 - 4} y={SUELO - 15} width="8" height="15" rx="1.5" fill={PINTURA.puerta[indice % 3]} />
    </g>
  )
}

function Arbol({ x, escala, fruto }) {
  return (
    <g transform={`translate(${x} ${SUELO + 4}) scale(${escala})`}>
      <ellipse cx="0" cy="1" rx="14" ry="3" fill="#10206b" opacity="0.18" />
      <rect x="-2.5" y="-28" width="5" height="28" rx="1.5" fill="#8a5a3c" />
      <circle cx="-10" cy="-32" r="12" fill="#2f9a5f" />
      <circle cx="10" cy="-33" r="12" fill="#2f9a5f" />
      <circle cx="0" cy="-42" r="17" fill="#3aa468" />
      <circle cx="-5" cy="-47" r="8" fill="#6fcf8f" opacity="0.85" />
      <circle cx="-9" cy="-30" r="2.4" fill={fruto} />
      <circle cx="8" cy="-38" r="2.4" fill={fruto} />
      <circle cx="2" cy="-26" r="2.4" fill={fruto} />
      <circle cx="-2" cy="-50" r="2.2" fill={fruto} />
    </g>
  )
}

function Parterre({ x, indice }) {
  const flores = []
  for (let k = 0; k < 8; k += 1) {
    flores.push({
      clave: k,
      cx: x - 14 + k * 4 + ((k * 5) % 3),
      cy: SUELO + 8 - ((k * 7) % 5),
      color: PINTURA.flores[(k + indice) % PINTURA.flores.length],
    })
  }
  return (
    <g>
      <ellipse cx={x} cy={SUELO + 11} rx="19" ry="6" fill="#2f9a5f" />
      {flores.map((f) => (
        <g key={f.clave}>
          <circle cx={f.cx} cy={f.cy} r="2.8" fill={f.color} />
          <circle cx={f.cx} cy={f.cy} r="0.9" fill="#ffd36b" />
        </g>
      ))}
    </g>
  )
}

export default function IlustracionLogin() {
  const id = useId()
  const url = (nombre) => `url(#${id}-${nombre})`

  return (
    <svg className="login-ilustracion" viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-recorte`}>
          <rect width={ANCHO} height={ALTO} rx="24" />
        </clipPath>
        <clipPath id={`${id}-cono`}>
          <path d="M120 340C230 300 350 200 420 124Q430 108 444 106Q458 106 466 120C510 180 590 270 700 340Z" />
        </clipPath>
        <linearGradient id={`${id}-cielo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f58e0" />
          <stop offset="0.45" stopColor="#5f86f5" />
          <stop offset="0.8" stopColor="#bcd0ff" />
          <stop offset="1" stopColor="#ffe9d2" />
        </linearGradient>
        <linearGradient id={`${id}-volcan`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7186d6" />
          <stop offset="1" stopColor="#4a63b4" />
        </linearGradient>
        <radialGradient id={`${id}-sol`}>
          <stop offset="0" stopColor="#fff6cf" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-vidrio`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b7cff" />
          <stop offset="0.5" stopColor="#ff8a5c" />
          <stop offset="1" stopColor="#ff6fa5" />
        </linearGradient>
      </defs>

      <g clipPath={url('recorte')}>
        {/* 1. cielo, sol y nubes */}
        <rect width={ANCHO} height={ALTO} fill={url('cielo')} />
        <circle cx="86" cy="76" r="60" fill={url('sol')} />
        <circle cx="86" cy="76" r="20" fill="#fff3c4" />
        <g className="login-nubes">
          {NUBES.map((n) => (
            <Nube key={n.clase} {...n} />
          ))}
        </g>

        {/* 2. volcán Tungurahua, con cumbre nevada y humo */}
        <path className="login-cordillera" d="M0 300C40 270 80 262 120 280S190 250 240 270 330 240 380 262 470 244 520 262 580 250 600 258V340H0Z" />
        <g className="login-volcan">
          <path d="M120 340C230 300 350 200 420 124Q430 108 444 106Q458 106 466 120C510 180 590 270 700 340Z" fill={url('volcan')} />
          <g clipPath={url('cono')}>
            <path d="M444 106Q458 106 466 120C510 180 590 270 700 340H500C490 260 470 180 444 106Z" fill="#2a3d8f" opacity="0.28" />
            <path className="login-nieve" d="M380 90H520V152L500 142L488 162L474 146L460 170L446 148L432 172L418 148L404 162L394 144L380 156Z" />
            <path d="M410 190L430 230M470 180L486 240M436 260L452 300M500 230L520 270" stroke="#a9bbf5" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
          </g>
          <ellipse cx="444" cy="108" rx="11" ry="3.5" fill="#3d4f9c" />
        </g>
        <g className="login-humo">
          <circle className="login-humo-bola login-humo-1" cx="444" cy="98" r="9" />
          <circle className="login-humo-bola login-humo-2" cx="448" cy="98" r="11" />
          <circle className="login-humo-bola login-humo-3" cx="441" cy="98" r="8" />
        </g>

        {/* 3. colinas verdes */}
        <path d="M0 292C70 262 140 262 210 280S350 296 420 274 540 252 600 268V370H0Z" fill="#7bcf9b" />
        <path d="M24 288Q100 270 180 286M300 292Q380 280 440 282M470 274Q540 262 590 272" stroke="#a6e3bb" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M0 316C90 292 170 296 250 312S400 322 480 304 560 292 600 300V370H0Z" fill="#43ad73" />
        <path d="M20 322Q100 306 190 320M330 326Q410 322 470 312" stroke="#6fcf8f" strokeWidth="2" fill="none" opacity="0.8" />
        <g fill="#ffffff" opacity="0.9">
          <rect x="30" y="296" width="7" height="5" />
          <rect x="62" y="300" width="6" height="4" />
          <rect x="272" y="306" width="7" height="5" />
          <rect x="520" y="292" width="7" height="5" />
          <rect x="560" y="298" width="6" height="4" />
        </g>

        {/* 4. la ciudad */}
        <g className="login-ciudad-fondo">
          {FONDO_CIUDAD.map((b) => (
            <rect key={b.x} x={b.x} y={SUELO - 6 - b.h} width={b.w} height={b.h + 6} rx="2" />
          ))}
        </g>
        <g className="login-ciudad">
          {EDIFICIOS.map((e, i) => (
            <Edificio key={e.x} indice={i} {...e} />
          ))}
        </g>

        {/* Catedral de Ambato: fachada triangular moderna y torre con cruz */}
        <g className="login-catedral">
          <rect x="232" y="296" width="134" height="56" fill="#fff5e4" />
          <rect x="356" y="296" width="10" height="56" fill="#10206b" opacity="0.07" />
          <polygon points="226,296 299,226 372,296" fill="#fffaf0" stroke="#d9c8a8" strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="240,292 299,238 358,292" fill="none" stroke="#2851d8" strokeWidth="3" strokeLinejoin="round" />
          <polygon points="252,292 299,252 346,292" fill="none" stroke="#8fa8ff" strokeWidth="2" strokeLinejoin="round" />
          <path d="M291 292V266a8 8 0 0 1 16 0V292z" fill={url('vidrio')} />
          <path d="M299 258V292M291 272H307M291 283H307" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
          <g fill="#eadcc2">
            <rect x="240" y="296" width="6" height="56" />
            <rect x="250" y="296" width="6" height="56" />
            <rect x="342" y="296" width="6" height="56" />
            <rect x="352" y="296" width="6" height="56" />
          </g>
          <rect x="262" y="314" width="10" height="20" rx="5" fill={PINTURA.ventana} />
          <rect x="326" y="314" width="10" height="20" rx="5" fill={PINTURA.ventana} />
          <path d="M283 352V330a16 16 0 0 1 32 0V352z" fill="#27408f" />
          <path d="M289 352V332a10 10 0 0 1 20 0V352z" fill={PINTURA.luz} opacity="0.9" />
          <path d="M299 322V352" stroke="#27408f" strokeWidth="1.5" />
          <rect x="276" y="346" width="46" height="3" fill="#e2d6bd" />
          <rect x="272" y="349" width="54" height="3" fill="#d6c8aa" />
          {/* torre */}
          <rect x="372" y="200" width="26" height="152" fill="#fff0d6" />
          <rect x="392" y="200" width="6" height="152" fill="#10206b" opacity="0.07" />
          <rect x="372" y="290" width="26" height="2" fill="#e4d3b0" />
          <rect x="368" y="200" width="34" height="6" fill="#e4d3b0" />
          <path d="M377 232V217a3 3 0 0 1 6 0V232zM387 232V217a3 3 0 0 1 6 0V232z" fill="#27408f" />
          <circle cx="385" cy="262" r="7.5" fill="#ffffff" stroke="#27408f" strokeWidth="1.5" />
          <path d="M385 262V257M385 262L389 262" stroke="#27408f" strokeWidth="1.3" strokeLinecap="round" />
          <polygon points="372,200 398,200 385,150" fill="#2851d8" />
          <polygon points="385,150 398,200 385,200" fill="#10206b" opacity="0.22" />
          <rect x="383.5" y="128" width="3" height="24" rx="1" fill="#ffd36b" />
          <rect x="378" y="135" width="14" height="3" rx="1" fill="#ffd36b" />
        </g>

        {/* vereda, calle y paso cebra */}
        <rect y={SUELO} width={ANCHO} height="22" fill="#dfe7fb" />
        <rect y="372" width={ANCHO} height="3" fill="#b9c6ea" />
        <rect y="375" width={ANCHO} height="53" fill="#34457f" />
        <rect y="428" width={ANCHO} height="3" fill="#b9c6ea" />
        <rect y="431" width={ANCHO} height="9" fill="#dfe7fb" />
        <path d="M0 401H600" stroke="#ffffff" strokeWidth="3" strokeDasharray="22 16" opacity="0.8" />
        <g fill="#ffffff" opacity="0.85">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={292 + i * 9} y="379" width="5" height="44" />
          ))}
        </g>

        {/* farolas */}
        {[196, 452].map((x) => (
          <g key={x}>
            <circle cx={x} cy="318" r="14" fill="#fff3c4" opacity="0.28" />
            <rect x={x - 1.5} y="322" width="3" height="40" rx="1.5" fill="#27408f" />
            <rect x={x - 6} y="316" width="12" height="7" rx="3" fill="#ffd36b" />
          </g>
        ))}

        {/* 5. árboles y flores */}
        {ARBOLES.map((a) => (
          <Arbol key={a.x} {...a} />
        ))}
        {PARTERRES.map((x, i) => (
          <Parterre key={x} x={x} indice={i} />
        ))}

        {/* 6. furgoneta de entregas cruzando la calle */}
        <g transform="translate(0 416)">
          <g className="login-furgoneta">
            <ellipse cx="48" cy="3" rx="50" ry="4" fill="#0e1a4d" opacity="0.35" />
            <g className="login-furgoneta-cuerpo">
              <rect x="0" y="-44" width="60" height="36" rx="5" fill="#2851d8" />
              <rect x="0" y="-22" width="60" height="5" fill="#ffffff" opacity="0.9" />
              <path transform="translate(30 -24) scale(0.55)" d={FORMA_PIN} fill="#ffffff" />
              <circle cx="30" cy="-38.3" r="2.6" fill="#2851d8" />
              <path d="M60 -34H78Q84 -34 88 -26L94 -16Q96 -13 96 -9V-8H60Z" fill="#3d63ec" />
              <path d="M64 -30H77Q80 -30 83 -25L87 -18H64Z" fill="#cfe0ff" />
              <path d="M66 -29H72L69 -19H66Z" fill="#ffffff" opacity="0.5" />
              <rect x="92" y="-12" width="6" height="4" rx="1" fill="#1f3a9a" />
              <rect x="93" y="-21" width="3.5" height="5" rx="1" fill="#ffe08a" />
              <rect x="-1" y="-20" width="3" height="6" rx="1" fill="#ff5a4f" />
              <path d="M8 -8a8.5 8.5 0 0 1 17 0zM68 -8a8.5 8.5 0 0 1 17 0z" fill="#10206b" />
            </g>
            {[16, 76].map((cx) => (
              <g key={cx} transform={`translate(${cx} -6)`}>
                <circle r="8.5" fill="#1c2447" />
                <g className="login-rueda">
                  <circle r="4.2" fill="#aab8e8" />
                  <path d="M-4 0H4M0 -4V4" stroke="#1c2447" strokeWidth="1.2" />
                </g>
              </g>
            ))}
          </g>
        </g>

        {/* 7. pines de entrega sobre tres casas */}
        {PINES.map((pin, i) => (
          <g key={pin.x} transform={`translate(${pin.x} ${pin.y})`}>
            <ellipse cx="0" cy="1" rx="8" ry="2.6" fill="#10206b" opacity="0.3" />
            <g className={`login-pin-rebote login-pin-${i + 1}`}>
              <path d={FORMA_PIN} fill="#2851d8" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
              <circle cx="0" cy="-26" r="5.5" fill="#ffffff" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  )
}
