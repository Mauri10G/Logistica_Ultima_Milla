import axios from 'axios'
import { API_URL } from '../entorno'
import { cerrarSesion, obtenerToken } from '../auth/sesion'

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

/** Un 401 (token vencido o inválido) borra la sesión; el login mismo no cuenta (credenciales erróneas). */
export function manejarRespuestaFallida(error) {
  const esLogin = error?.config?.url?.includes('/auth/login')
  if (error?.response?.status === 401 && !esLogin) cerrarSesion()
  return Promise.reject(error)
}

api.interceptors.request.use(agregarToken)
api.interceptors.response.use((respuesta) => respuesta, manejarRespuestaFallida)
