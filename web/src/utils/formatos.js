/** Formatea 2026-02-13T09:30:15 como "2026-02-13 09:30:15". */
export function formatearFechaHora(valor) {
  return valor ? valor.slice(0, 19).replace('T', ' ') : ''
}

/** Formatea 2026-02-13 como "13/02/2026" (para textos que lee el personal); lo que no tiene ese formato se devuelve igual. */
export function formatearFecha(valor) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '')
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : (valor ?? '')
}
