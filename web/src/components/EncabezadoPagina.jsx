/**
 * Encabezado de cada pantalla: título (h1), descripción corta y, a la derecha, las acciones de la página.
 * @param {string} titulo
 * @param {string} [descripcion]
 * @param {ReactNode} [children] acciones (botones, indicador de conexión...)
 */
export default function EncabezadoPagina({ titulo, descripcion, children }) {
  return (
    <header className="encabezado-pagina">
      <div>
        <h1>{titulo}</h1>
        {descripcion && <p className="encabezado-descripcion">{descripcion}</p>}
      </div>
      {children && <div className="encabezado-acciones">{children}</div>}
    </header>
  )
}
