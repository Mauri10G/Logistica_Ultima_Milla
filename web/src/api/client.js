import axios from 'axios'
import { API_URL } from '../entorno'
import { expirarSesion, obtenerToken } from '../auth/sesion'

export { mensajeDeError } from '../utils/errores'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

/** Cada petición lleva Authorization: Bearer <token> cuando hay sesión. */
export function agregarToken(config) {
  const token = obtenerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}

/**
 * 401 NO_AUTENTICADO (token ausente, vencido o inválido): borra la sesión y la web vuelve al login con el aviso.
 * 403 ACCESO_DENEGADO no cierra la sesión: el usuario sigue dentro y la pantalla muestra el aviso (ver mensajeDeError).
 * El login fallido responde 401 CREDENCIALES_INVALIDAS, que no entra aquí.
 */
export function manejarRespuestaFallida(error) {
  if (error?.response?.status === 401 && error.response.data?.codigo === 'NO_AUTENTICADO') expirarSesion()
  return Promise.reject(error)
}

api.interceptors.request.use(agregarToken)
api.interceptors.response.use((respuesta) => respuesta, manejarRespuestaFallida)
