import { useCallback, useRef, useState } from 'react'
import ConfirmarDialogo from '../components/ConfirmarDialogo'

/**
 * Confirmaciones con el diálogo propio, sin el cuadro del navegador. Uso en una pantalla:
 *
 *   const { pedir, dialogo } = useConfirmacion()
 *   ...
 *   if (!(await pedir({ titulo: '¿Eliminar el pedido 7?', textoConfirmar: 'Eliminar pedido' }))) return
 *   ...
 *   return <section>{dialogo}...</section>
 *
 * `pedir` devuelve una promesa: true si la persona confirmó, false si canceló (botón o Esc). Si se pasa `onConfirmar`
 * (asíncrono), el diálogo queda abierto con el botón en "cargando" hasta que termine y recién entonces se cierra y
 * la promesa se resuelve; si falla, se cierra y la promesa da false (la acción debe mostrar su propio error).
 * Las demás opciones son las de ConfirmarDialogo.
 */
export function useConfirmacion() {
  const [abierto, setAbierto] = useState(null)
  const actual = useRef(null)

  const cerrar = useCallback((resultado) => {
    const pendiente = actual.current
    actual.current = null
    setAbierto(null)
    pendiente?.resolver(resultado)
  }, [])

  const pedir = useCallback(
    (opciones) =>
      new Promise((resolver) => {
        actual.current?.resolver(false) // si había otra pregunta abierta, se da por cancelada
        const pendiente = { opciones, resolver }
        actual.current = pendiente
        setAbierto(pendiente)
      }),
    [],
  )

  function confirmar() {
    const accion = abierto.opciones.onConfirmar
    if (!accion) {
      cerrar(true) // sin acción propia se cierra al instante
      return undefined
    }
    return (async () => {
      let resultado = true
      try {
        await accion()
      } catch {
        resultado = false
      }
      cerrar(resultado)
    })()
  }

  const dialogo = abierto && (
    <ConfirmarDialogo {...abierto.opciones} onConfirmar={confirmar} onCancelar={() => cerrar(false)} />
  )

  return { pedir, dialogo }
}
