import { fechaIso } from '../hooks/fechas'

export const MENSAJE_FECHA_PASADA = 'La fecha de entrega no puede ser anterior a hoy'
export const MENSAJE_SIN_UBICACION = 'Haga clic en el mapa para indicar la ubicación de entrega'

/** Valida en el cliente lo que el backend también valida (CP-04) y la ubicación elegida en el mapa. */
export function validarPedido(valores, hoy = fechaIso(0)) {
  const errores = {}
  if (valores.fechaEntrega && valores.fechaEntrega < hoy) errores.fechaEntrega = MENSAJE_FECHA_PASADA
  if (valores.latitud === '' || valores.longitud === '') errores.ubicacion = MENSAJE_SIN_UBICACION
  return errores
}
