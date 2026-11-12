import { fechaIso } from '../hooks/fechas'

export const MENSAJE_FECHA_PASADA = 'La fecha de entrega no puede ser anterior a hoy'
export const MENSAJE_SIN_UBICACION = 'Haga clic en el mapa para indicar la ubicación de entrega'

/** "19:15:00" -> "19:15" (el backend devuelve las horas con segundos). */
export function horaHHmm(hora) {
  return String(hora ?? '').slice(0, 5)
}

/**
 * true si la respuesta de GET /api/servidor/hora trae lo necesario para validar. Si no (el endpoint no responde,
 * o es un backend anterior), la web no valida fecha ni hora y deja que el backend lo haga y explique el rechazo.
 */
export function horaServidorValida(datos) {
  return Boolean(datos?.fecha && datos?.hora && datos?.entregaMinimaFecha && datos?.entregaMinimaHora)
}

/** Fecha por defecto de un pedido nuevo: la primera con entregas posibles según el servidor (no el computador). */
export function fechaPorDefecto(horaServidor) {
  return horaServidor?.entregaMinimaFecha ?? fechaIso(0)
}

/** Hora mínima del campo de hora: solo aplica si la fecha elegida es la primera con entregas posibles. */
export function horaMinimaEntrega(fechaEntrega, horaServidor) {
  if (!horaServidor || fechaEntrega !== horaServidor.entregaMinimaFecha) return undefined
  return horaHHmm(horaServidor.entregaMinimaHora)
}

export function mensajeHoraInvalida(horaServidor) {
  return (
    `La hora de entrega debe ser al menos ${horaServidor.anticipacionMinimaMinutos} minutos ` +
    `después de la hora actual del servidor, ${horaHHmm(horaServidor.hora)}`
  )
}

/**
 * Fecha y hora de entrega contra la hora del SERVIDOR (nunca la del computador, que el usuario puede cambiar).
 * Devuelve { fechaEntrega?, horaEntrega? } con el mensaje de cada campo inválido. Sin hora del servidor no valida nada.
 */
export function validarEntrega(fechaEntrega, horaEntrega, horaServidor) {
  const errores = {}
  if (!horaServidorValida(horaServidor) || !fechaEntrega) return errores
  if (fechaEntrega < horaServidor.fecha) {
    errores.fechaEntrega = MENSAJE_FECHA_PASADA
  } else if (horaEntrega && `${fechaEntrega}T${horaHHmm(horaEntrega)}` <
      `${horaServidor.entregaMinimaFecha}T${horaHHmm(horaServidor.entregaMinimaHora)}`) {
    errores.horaEntrega = mensajeHoraInvalida(horaServidor)
  }
  return errores
}

/** Valida en el cliente lo que el backend también valida (CP-04, hora de entrega) y la ubicación elegida en el mapa. */
export function validarPedido(valores, horaServidor = null) {
  const errores = validarEntrega(valores.fechaEntrega, valores.horaEntrega, horaServidor)
  if (valores.latitud === '' || valores.longitud === '') errores.ubicacion = MENSAJE_SIN_UBICACION
  return errores
}
