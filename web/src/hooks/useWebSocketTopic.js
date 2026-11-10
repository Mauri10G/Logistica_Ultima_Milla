import { useEffect, useRef, useState } from 'react'
import { alCambiarConexion, suscribirse } from '../services/websocket'

/**
 * Escucha un topico STOMP mientras el componente esta montado.
 * @returns {boolean} true si el WebSocket esta conectado
 */
export function useWebSocketTopic(topic, onMensaje) {
  const [conectado, setConectado] = useState(false)
  const ultimoCallback = useRef(onMensaje)

  useEffect(() => {
    ultimoCallback.current = onMensaje
  }, [onMensaje])

  useEffect(() => {
    const cancelarConexion = alCambiarConexion(setConectado)
    const cancelar = suscribirse(topic, (mensaje) => ultimoCallback.current(mensaje))
    return () => {
      cancelar()
      cancelarConexion()
    }
  }, [topic])

  return conectado
}
