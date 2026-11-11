/** Formatea 2026-02-13T09:30:15 como "2026-02-13 09:30:15". */
export function formatearFechaHora(valor) {
  return valor ? valor.slice(0, 19).replace('T', ' ') : ''
}
