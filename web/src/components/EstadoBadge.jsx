import { ETIQUETAS_ESTADO } from '../utils/estados'

/** Badge de color de un estado (pedido o ruta). Los colores salen de las variables --estado-* de index.css. */
export default function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{ETIQUETAS_ESTADO[estado] ?? estado}</span>
}
