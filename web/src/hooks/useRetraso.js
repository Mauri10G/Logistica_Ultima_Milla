import { useEffect, useState } from 'react'

/** Devuelve `valor` solo después de que pasen `ms` sin que cambie (útil para no consultar al backend en cada tecla). */
export function useRetraso(valor, ms) {
  const [retrasado, setRetrasado] = useState(valor)

  useEffect(() => {
    if (valor === retrasado) return undefined
    const temporizador = setTimeout(() => setRetrasado(valor), ms)
    return () => clearTimeout(temporizador)
  }, [valor, retrasado, ms])

  return retrasado
}
