/** Indicador de carga con texto. No usa role="status" para no mezclarse con otros avisos de la pantalla. */
export default function Cargando({ texto = 'Cargando…', bloque = false }) {
  return (
    <div className={bloque ? 'cargando cargando-bloque' : 'cargando'} aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

/** Filas de esqueleto para una tabla mientras llegan los datos. */
export function FilasCarga({ columnas, filas = 5 }) {
  return Array.from({ length: filas }, (_, indice) => (
    <tr key={indice} className="fila-carga">
      <td colSpan={columnas}>
        <span className="esqueleto" aria-hidden="true" />
        {indice === 0 && <span className="solo-lectores">Cargando datos…</span>}
      </td>
    </tr>
  ))
}
