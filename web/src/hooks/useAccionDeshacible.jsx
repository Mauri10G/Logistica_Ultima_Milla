import { useCallback, useEffect, useRef, useState } from 'react'
import AvisosDeshacer from '../components/AvisosDeshacer'

export const DURACION_DESHACER_MS = 6000

/**
 * Acciones que se pueden deshacer durante unos segundos. La acción NO se ejecuta al pedirla: se programa, la
 * pantalla la muestra como ya hecha (p. ej. oculta la fila) y sale un aviso con "Deshacer" y una barra de 6 segundos.
 *
 * - Al terminar el tiempo se ejecuta (`ejecutar`).
 * - Si la persona pulsa "Deshacer" no se ejecuta nunca y se llama a `alDeshacer` (la pantalla vuelve a mostrar lo oculto).
 * - Si la persona cambia de pantalla (el componente se desmonta) o cierra la pestaña antes de que termine, se ejecuta
 *   al instante: ya no podría deshacerla. Al cerrar la pestaña `ejecutar` recibe `{ alSalir: true }` para que use una
 *   petición que el navegador no cancele al descargar la página (keepalive).
 *
 * Uso: const { programar, avisosDeshacer } = useAccionDeshacible()  y  <section>{avisosDeshacer}…</section>
 */
export function useAccionDeshacible({ duracion = DURACION_DESHACER_MS } = {}) {
  const [avisos, setAvisos] = useState([])
  const registro = useRef(new Map()) // id -> { ejecutar, alDeshacer, temporizador }
  const contador = useRef(0)

  const quitarAviso = useCallback((id) => setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id)), [])

  /** Saca la acción del registro y la ejecuta. No hace nada si ya se ejecutó o se deshizo. */
  const ejecutarYa = useCallback(
    (id, alSalir) => {
      const entrada = registro.current.get(id)
      if (!entrada) return
      registro.current.delete(id)
      clearTimeout(entrada.temporizador)
      quitarAviso(id)
      // la propia acción informa su éxito o su error; aquí solo se evita una promesa rechazada sin atender
      Promise.resolve(entrada.ejecutar({ alSalir })).catch(() => {})
    },
    [quitarAviso],
  )

  const programar = useCallback(
    ({ mensaje, ejecutar, alDeshacer }) => {
      const id = ++contador.current
      const temporizador = setTimeout(() => ejecutarYa(id, false), duracion)
      registro.current.set(id, { ejecutar, alDeshacer, temporizador })
      setAvisos((actuales) => [...actuales, { id, mensaje }])
      return id
    },
    [duracion, ejecutarYa],
  )

  const deshacer = useCallback(
    (id) => {
      const entrada = registro.current.get(id)
      if (!entrada) return
      registro.current.delete(id)
      clearTimeout(entrada.temporizador)
      quitarAviso(id)
      entrada.alDeshacer?.()
    },
    [quitarAviso],
  )

  useEffect(() => {
    const pendientes = registro.current
    const ejecutarTodas = () => [...pendientes.keys()].forEach((id) => ejecutarYa(id, true))
    window.addEventListener('pagehide', ejecutarTodas)
    return () => {
      window.removeEventListener('pagehide', ejecutarTodas)
      ejecutarTodas() // cambio de pantalla
    }
  }, [ejecutarYa])

  const avisosDeshacer = <AvisosDeshacer avisos={avisos} duracion={duracion} onDeshacer={deshacer} />
  return { programar, avisosDeshacer }
}
