// Rutas decorativas del fondo del formulario: cada una es un trazo y un par de paradas.
const RUTAS = [
  { id: 'r1', d: 'M-20 130C120 90 160 220 300 190S470 70 640 130', paradas: [[300, 190]] },
  { id: 'r2', d: 'M-20 420C90 360 190 470 300 430S500 330 640 400', paradas: [[90, 380], [500, 345]] },
  { id: 'r3', d: 'M-20 700C130 640 190 760 340 710S520 600 640 660', paradas: [[340, 710]] },
  { id: 'r4', d: 'M120 -20C60 140 200 260 130 420S60 640 140 820', paradas: [] },
]

/**
 * Fondo muy suave para el lado del formulario: líneas de ruta punteadas casi transparentes, para que no se vea
 * vacío. Es decorativo (aria-hidden) y estático.
 */
export default function FondoRutas() {
  return (
    <svg
      className="login-fondo-rutas"
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {RUTAS.map((ruta) => (
        <g key={ruta.id}>
          <path d={ruta.d} className="login-fondo-linea" fill="none" />
          {ruta.paradas.map(([x, y]) => (
            <g key={`${x}-${y}`} className="login-fondo-parada">
              <circle cx={x} cy={y} r="14" className="login-fondo-halo" />
              <circle cx={x} cy={y} r="5" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}
