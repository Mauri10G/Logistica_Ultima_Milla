import { Inbox } from 'lucide-react'

/**
 * Mensaje para cuando no hay datos: ícono, título y, si hace falta, una sugerencia de qué hacer.
 * @param {string} titulo
 * @param {string} [ayuda]
 * @param {import('react').ComponentType} [icono] ícono de lucide-react
 */
export default function EstadoVacio({ titulo, ayuda, icono: Icono = Inbox }) {
  return (
    <div className="estado-vacio">
      <span className="estado-vacio-icono">
        <Icono size={22} aria-hidden="true" />
      </span>
      <p className="estado-vacio-titulo">{titulo}</p>
      {ayuda && <p className="estado-vacio-ayuda">{ayuda}</p>}
    </div>
  )
}
