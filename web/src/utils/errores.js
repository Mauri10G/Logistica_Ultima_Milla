/** Mensaje legible de un error de axios: usa el cuerpo uniforme de la API ({ codigo, mensaje, errores }). */
export function mensajeDeError(error) {
  const datos = error?.response?.data
  if (datos?.errores) {
    const detalle = Object.entries(datos.errores)
      .map(([campo, texto]) => `${campo}: ${texto}`)
      .join('; ')
    return `${datos.mensaje} (${detalle})`
  }
  if (datos?.mensaje) return datos.mensaje
  if (error?.code === 'ERR_NETWORK' || (error?.request && !error?.response)) {
    return 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución.'
  }
  return error?.message || 'Error desconocido'
}

/** Código HTTP de la respuesta, o undefined si no hubo respuesta. */
export function estadoHttp(error) {
  return error?.response?.status
}

/** Código de dominio del cuerpo de error (p. ej. ZONA_SUPERPUESTA, DIRECCION_FUERA_DE_ZONA). */
export function codigoDeError(error) {
  return error?.response?.data?.codigo
}

/**
 * true si el endpoint todavía no existe en el backend: 405, o un 404 que viene del enrutador de Spring
 * (código NOT_FOUND) y no de un recurso inexistente (RECURSO_NO_ENCONTRADO).
 */
export function endpointNoDisponible(error) {
  const estado = estadoHttp(error)
  if (estado === 405) return true
  if (estado !== 404) return false
  const codigo = codigoDeError(error)
  return !codigo || codigo === 'NOT_FOUND'
}

export const MENSAJE_FUNCION_NO_DISPONIBLE = 'Función disponible cuando el backend la publique'

/**
 * Mensaje claro para un error al registrar, editar o eliminar un pedido:
 * 422 fuera de zona (CP-03), 422 fecha pasada (CP-04) y 409 pedido no editable (CP-05).
 */
export function mensajeDeErrorPedido(error) {
  const estado = estadoHttp(error)
  const codigo = codigoDeError(error)
  if (estado === 422 && codigo === 'DIRECCION_FUERA_DE_ZONA') {
    return 'La dirección no corresponde a ninguna zona configurada. Elija en el mapa un punto dentro de una zona.'
  }
  if (estado === 422 && codigo === 'FECHA_ENTREGA_PASADA') {
    return 'La fecha de entrega no puede ser anterior a hoy. Elija hoy o una fecha futura.'
  }
  if (estado === 409) {
    return 'Este pedido ya no se puede modificar: solo los pedidos en estado PENDIENTE (antes del armado de su ruta) admiten cambios.'
  }
  return mensajeDeError(error)
}
