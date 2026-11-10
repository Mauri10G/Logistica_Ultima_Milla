import { useCallback, useEffect, useState } from 'react'
import { crearZona, listarZonas } from '../api/zonasApi'
import { mensajeDeError } from '../api/client'
import MapaZonas from '../components/MapaZonas'

const EJEMPLO_AREA = `{
  "type": "Polygon",
  "coordinates": [[[-78.60, -1.28], [-78.58, -1.28], [-78.58, -1.26], [-78.60, -1.26], [-78.60, -1.28]]]
}`

export default function ZonasPage() {
  const [zonas, setZonas] = useState([])
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState('')
  const [area, setArea] = useState(EJEMPLO_AREA)
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setZonas(await listarZonas())
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await crearZona({ nombre, area: JSON.parse(area) }, confirmar)
      setNombre('')
      setConfirmar(false)
      await cargar()
    } catch (e) {
      setError(e instanceof SyntaxError ? 'El área no es un JSON válido' : mensajeDeError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <header className="encabezado">
        <h2>Zonas</h2>
      </header>

      <div className="dos-columnas">
        <div>
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Activa</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((zona) => (
                <tr key={zona.id}>
                  <td>{zona.id}</td>
                  <td>{zona.nombre}</td>
                  <td>{zona.activa ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <form className="tarjeta formulario" onSubmit={guardar} aria-label="Nueva zona">
            <h3 className="ancho-completo">Nueva zona</h3>
            <div className="campo ancho-completo">
              <label htmlFor="zonaNombre">Nombre de la zona</label>
              <input id="zonaNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="campo ancho-completo">
              <label htmlFor="zonaArea">Área (GeoJSON Polygon)</label>
              <textarea id="zonaArea" rows={6} value={area} onChange={(e) => setArea(e.target.value)} required />
            </div>
            <div className="campo ancho-completo campo-check">
              <input id="zonaConfirmar" type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
              <label htmlFor="zonaConfirmar">Confirmar superposición con otras zonas</label>
            </div>
            {error && (
              <p className="mensaje-error ancho-completo" role="alert">
                {error}
              </p>
            )}
            <div className="acciones ancho-completo">
              <button type="submit" disabled={guardando}>
                Guardar zona
              </button>
            </div>
          </form>
        </div>

        <div className="tarjeta">
          <MapaZonas zonas={zonas.filter((zona) => zona.activa)} />
        </div>
      </div>
    </section>
  )
}
