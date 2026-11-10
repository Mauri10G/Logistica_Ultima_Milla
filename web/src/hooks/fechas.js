/** Fecha local (no UTC) en formato YYYY-MM-DD, desplazada `dias` respecto de hoy. */
export function fechaIso(dias = 0) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}
