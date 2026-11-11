import { Client } from '@stomp/stompjs'
import { alCambiarSesion, obtenerToken } from '../auth/sesion'
import { API_URL } from '../entorno'

/** ws://localhost:8080/ws (el backend expone STOMP sobre WebSocket nativo en /ws). */
export function urlWebSocket() {
  return `${API_URL.replace(/^http/, 'ws')}/ws`
}

export const TOPIC_PEDIDOS = '/topic/pedidos'
export const TOPIC_RUTAS = '/topic/rutas'

let cliente = null
const topicos = new Map() // topic -> { callbacks: Set, suscripcion }
const oyentesConexion = new Set()

function avisarConexion(conectado) {
  oyentesConexion.forEach((oyente) => oyente(conectado))
}

function suscribirTopico(topic, entrada) {
  entrada.suscripcion = cliente.subscribe(topic, (mensaje) => {
    let cuerpo
    try {
      cuerpo = JSON.parse(mensaje.body)
    } catch {
      return // mensaje que no es JSON: se ignora
    }
    entrada.callbacks.forEach((callback) => callback(cuerpo))
  })
}

/** Cabeceras del CONNECT: lleva Authorization: Bearer <token> cuando hay sesión. */
export function cabecerasConexion() {
  const token = obtenerToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function obtenerCliente() {
  if (cliente) return cliente
  cliente = new Client({
    brokerURL: urlWebSocket(),
    reconnectDelay: 3000,
    // Se evalúa en cada (re)conexión, así siempre usa el token vigente.
    beforeConnect: (conexion) => {
      conexion.connectHeaders = cabecerasConexion()
    },
    onConnect: () => {
      avisarConexion(true)
      topicos.forEach((entrada, topic) => suscribirTopico(topic, entrada))
    },
    onStompError: () => avisarConexion(false),
    onWebSocketClose: () => avisarConexion(false),
  })
  cliente.activate()
  return cliente
}

/**
 * Se suscribe a un topico STOMP. Comparte una sola conexion para toda la app y reconecta sola.
 * @returns {() => void} funcion para cancelar la suscripcion
 */
export function suscribirse(topic, callback) {
  const conexion = obtenerCliente()
  let entrada = topicos.get(topic)
  if (!entrada) {
    entrada = { callbacks: new Set(), suscripcion: null }
    topicos.set(topic, entrada)
    if (conexion.connected) suscribirTopico(topic, entrada)
  }
  entrada.callbacks.add(callback)

  return () => {
    entrada.callbacks.delete(callback)
    if (entrada.callbacks.size === 0) {
      try {
        entrada.suscripcion?.unsubscribe()
      } catch {
        // la conexión ya se cerró (p. ej. al cerrar sesión): no hay nada que cancelar
      }
      if (topicos.get(topic) === entrada) topicos.delete(topic)
    }
  }
}

/** Notifica cuando la conexion se abre o se cierra (para mostrar un indicador). */
export function alCambiarConexion(oyente) {
  oyentesConexion.add(oyente)
  if (cliente) oyente(cliente.connected)
  return () => oyentesConexion.delete(oyente)
}

/** Cierra la conexión (al cerrar sesión). La siguiente suscripción abre una nueva con el token nuevo. */
export function desconectar() {
  if (!cliente) return
  const anterior = cliente
  cliente = null
  topicos.clear()
  anterior.deactivate()
  avisarConexion(false)
}

// Al cerrar sesión (botón o 401) se corta la conexión: la siguiente se abrirá con el token nuevo.
alCambiarSesion((sesion) => {
  if (!sesion) desconectar()
})
