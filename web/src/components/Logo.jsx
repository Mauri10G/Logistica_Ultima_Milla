import { useId } from 'react'

/**
 * Logo del sistema, dibujado en SVG: un pin de entrega al final de una ruta con paradas.
 * Es decorativo (el nombre del sistema va al lado como texto), por eso va oculto a lectores de pantalla.
 */
export default function Logo({ className = 'marca-logo' }) {
  const id = useId()
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b7cff" />
          <stop offset="1" stopColor="#2851d8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${id}-fondo)`} />
      {/* ruta con paradas */}
      <path
        d="M11 35c5 0 6-7 11-7s5 5 9 5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 5"
        opacity="0.85"
      />
      <circle cx="11" cy="35" r="3.2" fill="#ffffff" />
      {/* pin de destino */}
      <path
        d="M31 9c-4.4 0-8 3.5-8 7.9 0 5.6 8 14.6 8 14.6s8-9 8-14.6C39 12.5 35.4 9 31 9z"
        fill="#ffffff"
      />
      <circle cx="31" cy="17" r="3" fill="#2851d8" />
    </svg>
  )
}
