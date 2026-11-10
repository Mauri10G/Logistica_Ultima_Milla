import axios from 'axios'
import { API_URL } from '../entorno'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

/** Mensaje legible de un error de axios: usa el cuerpo uniforme de la API ({ codigo, mensaje, errores }). */
export function mensajeDeError(error) {
  const datos = error?.response?.data
  if (datos?.errores) {
    const detalle = Object.entries(datos.errores)
      .map(([campo, texto]) => `${campo}: ${texto}`)
      .join('; ')
    return `${datos.mensaje} (${detalle})`
  }
  return datos?.mensaje || error?.message || 'Error desconocido'
}
