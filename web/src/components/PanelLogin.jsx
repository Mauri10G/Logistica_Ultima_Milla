import { MapPinned, Radio, Route } from 'lucide-react'
import IlustracionLogin from './IlustracionLogin'
import Logo from './Logo'

const PUNTOS = [
  { Icono: Route, texto: 'Rutas automáticas por zona y repartidor' },
  { Icono: Radio, texto: 'Seguimiento en vivo de cada pedido' },
  { Icono: MapPinned, texto: 'Zonas dibujadas directamente en el mapa' },
]

/** Columna izquierda del login y de la pantalla "Sin acceso": ilustración de Ambato, marca y puntos del sistema. */
export default function PanelLogin() {
  return (
    <section className="login-panel">
      <IlustracionLogin />
      <div className="login-panel-texto">
        <div className="login-panel-marca">
          <Logo />
          <span>Entregas y Rutas</span>
        </div>
        <p className="login-frase">Organiza tus entregas de última milla en tiempo real</p>
        <ul className="login-puntos">
          {PUNTOS.map(({ Icono, texto }) => (
            <li key={texto}>
              <span className="login-punto-icono">
                <Icono size={18} aria-hidden="true" />
              </span>
              {texto}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
