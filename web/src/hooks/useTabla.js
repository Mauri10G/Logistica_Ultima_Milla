import { useCallback, useMemo, useState } from 'react'

export const TAMANOS_PAGINA = [10, 25, 50]
export const TAMANO_PAGINA_INICIAL = 10

const COLLATOR = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

function vacio(valor) {
  return valor === null || valor === undefined || valor === ''
}

/** Compara dos valores de celda: números como números, el resto como texto (sin acentos ni mayúsculas). */
export function compararValores(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return COLLATOR.compare(String(a), String(b))
}

/** Ordena una copia de `filas` por `valor(fila)`; los vacíos van siempre al final, sea cual sea la dirección. */
export function ordenarFilas(filas, valor, direccion) {
  const signo = direccion === 'desc' ? -1 : 1
  return [...filas].sort((filaA, filaB) => {
    const a = valor(filaA)
    const b = valor(filaB)
    if (vacio(a) && vacio(b)) return 0
    if (vacio(a)) return 1
    if (vacio(b)) return -1
    return signo * compararValores(a, b)
  })
}

/**
 * Orden y paginación de una tabla. Tiene dos modos; las pantallas no notan la diferencia:
 *
 * - **Navegador** (por defecto): `filas` son todas las filas (ya filtradas por la pantalla) y el hook ordena y corta la página.
 * - **Servidor** (`remoto`): `filas` es solo la página que se muestra y `remoto.total` el total que informa el backend
 *   (cabecera X-Total-Count). La pantalla pide esa página con `pagina` y `tamano`. El backend todavía no ordena por columna
 *   ni busca por texto: mientras el usuario ordena o busca (`orden` o `remoto.buscando`) el hook pasa solo a modo navegador
 *   (`enServidor` = false) y la pantalla debe traer todas las filas; al limpiar la búsqueda vuelve a pedir página por página.
 *
 * @param {object[]} filas todas las filas (modo navegador) o solo las de la página actual (modo servidor)
 * @param {object} opciones
 * @param {Record<string, (fila: object) => string | number | null>} opciones.valores valor ordenable de cada columna
 * @param {{ clave: string, direccion: 'asc' | 'desc' }} [opciones.ordenInicial]
 * @param {number} [opciones.tamanoInicial] filas por página (10 por defecto)
 * @param {unknown[]} [opciones.reiniciarCon] al cambiar cualquiera de estos valores (filtros, búsqueda) vuelve a la página 1
 * @param {{ total: number, buscando?: boolean }} [opciones.remoto] activa el modo servidor
 */
export function useTabla(
  filas,
  { valores, ordenInicial = null, tamanoInicial = TAMANO_PAGINA_INICIAL, reiniciarCon = [], remoto = null },
) {
  const [orden, setOrden] = useState(ordenInicial)
  const [tamano, setTamano] = useState(tamanoInicial)
  const claveReinicio = JSON.stringify(reiniciarCon)
  const [solicitud, setSolicitud] = useState({ pagina: 1, clave: claveReinicio })

  // La página pedida solo vale mientras no cambie un filtro: así la vuelta a la página 1 no necesita un efecto.
  const paginaSolicitada = solicitud.clave === claveReinicio ? solicitud.pagina : 1

  const enServidor = Boolean(remoto) && !orden && !remoto.buscando

  const ordenadas = useMemo(() => {
    const valor = orden && valores[orden.clave]
    return valor ? ordenarFilas(filas, valor, orden.direccion) : filas
  }, [filas, orden, valores])

  const total = enServidor ? remoto.total : ordenadas.length
  const totalPaginas = Math.max(1, Math.ceil(total / tamano))
  const pagina = Math.min(paginaSolicitada, totalPaginas) // si las filas bajan (p. ej. se elimina una), no queda en una página vacía
  const inicio = (pagina - 1) * tamano
  const filasPagina = useMemo(
    () => (enServidor ? ordenadas : ordenadas.slice(inicio, inicio + tamano)),
    [enServidor, ordenadas, inicio, tamano],
  )

  const irAPagina = useCallback(
    (nueva) => setSolicitud({ pagina: Math.max(1, Math.min(nueva, totalPaginas)), clave: claveReinicio }),
    [totalPaginas, claveReinicio],
  )

  const cambiarTamano = useCallback(
    (nuevo) => {
      setTamano(nuevo)
      setSolicitud({ pagina: 1, clave: claveReinicio })
    },
    [claveReinicio],
  )

  /** Primer clic en una columna: ascendente; clic en la misma columna: invierte la dirección. */
  const ordenarPor = useCallback(
    (clave) => {
      setOrden((actual) => ({ clave, direccion: actual?.clave === clave && actual.direccion === 'asc' ? 'desc' : 'asc' }))
      setSolicitud({ pagina: 1, clave: claveReinicio })
    },
    [claveReinicio],
  )

  return {
    filasPagina,
    enServidor,
    total,
    pagina,
    totalPaginas,
    tamano,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: enServidor ? inicio + filasPagina.length : Math.min(inicio + tamano, total),
    orden,
    ordenarPor,
    irAPagina,
    cambiarTamano,
  }
}

/** Números de página a mostrar: siempre la primera, la última y las vecinas de la actual; "…" donde se omiten. */
export function numerosDePagina(pagina, totalPaginas) {
  const mostrar = new Set([1, totalPaginas, pagina - 1, pagina, pagina + 1])
  const numeros = [...mostrar].filter((n) => n >= 1 && n <= totalPaginas).sort((a, b) => a - b)
  const resultado = []
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) resultado.push('…')
    resultado.push(n)
  })
  return resultado
}
