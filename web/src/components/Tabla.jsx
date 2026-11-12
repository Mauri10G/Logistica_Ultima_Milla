import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { FilasCarga } from './Cargando'
import { numerosDePagina, TAMANOS_PAGINA, useTabla } from '../hooks/useTabla'

const ICONO_ORDEN = { asc: ArrowUp, desc: ArrowDown }
const ETIQUETA_ORDEN = { asc: 'ascendente', desc: 'descendente' }

function EncabezadoColumna({ columna, ordenable, orden, onOrdenar }) {
  if (!ordenable) {
    return (
      <th scope="col" className={columna.className}>
        {columna.titulo}
      </th>
    )
  }
  const activa = orden?.clave === columna.clave
  const Icono = activa ? ICONO_ORDEN[orden.direccion] : ArrowUpDown
  return (
    <th
      scope="col"
      className={columna.className}
      aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        className={activa ? 'orden-columna orden-activo' : 'orden-columna'}
        onClick={() => onOrdenar(columna.clave)}
        title={activa ? `Ordenado de forma ${ETIQUETA_ORDEN[orden.direccion]}; clic para invertir` : `Ordenar por ${columna.titulo}`}
      >
        {columna.titulo}
        <Icono size={14} aria-hidden="true" />
      </button>
    </th>
  )
}

/** Pie de la tabla: "Mostrando 1 a 10 de 24", anterior / números / siguiente y filas por página. */
export function Paginacion({ desde, hasta, total, pagina, totalPaginas, tamano, onPagina, onTamano }) {
  const idTamano = useId()
  return (
    <div className="paginacion">
      <p className="paginacion-texto" aria-live="polite">
        Mostrando {desde} a {hasta} de {total}
      </p>
      <nav className="paginacion-botones" aria-label="Paginación">
        <button type="button" className="secundario pequeno" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
          <ChevronLeft size={14} aria-hidden="true" />
          Anterior
        </button>
        {numerosDePagina(pagina, totalPaginas).map((numero, indice) =>
          numero === '…' ? (
            <span key={`puntos-${indice}`} className="paginacion-puntos" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={numero}
              type="button"
              className={numero === pagina ? 'pequeno pagina-actual' : 'secundario pequeno'}
              aria-label={`Página ${numero}`}
              aria-current={numero === pagina ? 'page' : undefined}
              onClick={() => onPagina(numero)}
            >
              {numero}
            </button>
          ),
        )}
        <button type="button" className="secundario pequeno" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
          Siguiente
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </nav>
      <div className="campo campo-tamano">
        <label htmlFor={idTamano}>Filas por página</label>
        <select id={idTamano} value={tamano} onChange={(e) => onTamano(Number(e.target.value))}>
          {TAMANOS_PAGINA.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * Tabla reutilizable con encabezados que ordenan y paginación. Las pantallas le pasan las filas ya filtradas
 * y dibujan cada fila; el orden y la página viven en `useTabla` (hoy en el navegador, mañana en el backend).
 *
 * @param {string} titulo texto de la caption (solo para lectores de pantalla)
 * @param {{ clave: string, titulo: string, className?: string, ordenable?: boolean }[]} columnas
 *   una columna con `valores[clave]` ordena al pulsar su encabezado; `ordenable: false` lo desactiva
 * @param {Record<string, (fila: object) => string | number | null>} valores valor ordenable de cada columna (constante de módulo)
 * @param {object[]} filas filas ya filtradas
 * @param {(fila: object) => import('react').ReactElement} renderFila devuelve el <tr> de la fila, con su key
 * @param {boolean} [cargando] muestra filas de esqueleto y marca la tabla como ocupada
 * @param {import('react').ReactNode} [vacio] contenido cuando no hay filas
 * @param {{ clave: string, direccion: 'asc' | 'desc' }} [ordenInicial]
 * @param {unknown[]} [reiniciarCon] valores (filtros, búsqueda) que devuelven la tabla a la página 1 al cambiar
 * @param {number} [tamanoInicial] filas por página, 10 por defecto
 */
export default function Tabla({
  titulo,
  columnas,
  valores,
  filas,
  renderFila,
  cargando = false,
  vacio = null,
  ordenInicial,
  reiniciarCon,
  tamanoInicial,
}) {
  const tabla = useTabla(filas, { valores, ordenInicial, reiniciarCon, tamanoInicial })
  const sinFilas = !cargando && tabla.total === 0

  return (
    <div className="tabla-contenedor">
      <table className="tabla" aria-busy={cargando}>
        <caption className="solo-lectores">{titulo}</caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <EncabezadoColumna
                key={columna.clave}
                columna={columna}
                ordenable={columna.ordenable !== false && Boolean(valores[columna.clave])}
                orden={tabla.orden}
                onOrdenar={tabla.ordenarPor}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando && <FilasCarga columnas={columnas.length} />}
          {tabla.filasPagina.map(renderFila)}
          {sinFilas && (
            <tr>
              <td colSpan={columnas.length} className="vacio">
                {vacio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!cargando && tabla.total > 0 && (
        <Paginacion
          desde={tabla.desde}
          hasta={tabla.hasta}
          total={tabla.total}
          pagina={tabla.pagina}
          totalPaginas={tabla.totalPaginas}
          tamano={tabla.tamano}
          onPagina={tabla.irAPagina}
          onTamano={tabla.cambiarTamano}
        />
      )}
    </div>
  )
}
