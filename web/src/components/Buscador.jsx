import { Search } from 'lucide-react'

/**
 * Campo de búsqueda con su label visible (type="search": los lectores de pantalla lo anuncian como buscador).
 * La pantalla decide qué campos busca; este componente solo muestra y entrega el texto.
 */
export default function Buscador({ id, etiqueta, valor, onCambiar, placeholder }) {
  return (
    <div className="campo campo-busqueda">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="busqueda">
        <Search size={16} aria-hidden="true" />
        <input id={id} type="search" value={valor} placeholder={placeholder} onChange={(e) => onCambiar(e.target.value)} />
      </div>
    </div>
  )
}
