import { Client } from '@stomp/stompjs'
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
    const cuerpo = JSON.parse(mensaje.body)
    entrada.callbacks.forEach((callback) => callback(cuerpo))
  })
}

function obtenerCliente() {
  if (cliente) return cliente
  cliente = new Client({
    brokerURL: urlWebSocket(),
    reconnectDelay: 3000,
    onConnect: () => {
      avisarConexion(true)
      topicos.forEach((entrada, topic) => suscribirTopico(topic, entrada))
    },
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
      entrada.suscripcion?.unsubscribe()
      topicos.delete(topic)
    }
  }
}

/** Notifica cuando la conexion se abre o se cierra (para mostrar un indicador). */
export function alCambiarConexion(oyente) {
  oyentesConexion.add(oyente)
  if (cliente) oyente(cliente.connected)
  return () => oyentesConexion.delete(oyente)
}
