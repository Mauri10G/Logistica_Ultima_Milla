import { useCallback, useEffect, useState } from 'react'
import { actualizarZona, crearZona, listarZonas } from '../api/zonasApi'
import { codigoDeError, estadoHttp, mensajeDeError } from '../utils/errores'
import ZonaForm from '../components/ZonaForm'

export default function ZonasPage() {
  const [zonas, setZonas] = useState([])
  const [zonaEnEdicion, setZonaEnEdicion] = useState(null)
  const [errorLista, setErrorLista] = useState(null)
  const [errorForm, setErrorForm] = useState(null)
  const [advertencia, setAdvertencia] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [version, setVersion] = useState(0) // cambia tras guardar para vaciar el formulario

  const cargar = useCallback(async () => {
    try {
      setZonas(await listarZonas())
      setErrorLista(null)
    } catch (e) {
      setErrorLista(mensajeDeError(e))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function limpiarAvisos() {
    setErrorForm(null)
    setAdvertencia(null)
  }

  function editar(zona) {
    setZonaEnEdicion(zona)
    setMensaje(null)
    limpiarAvisos()
  }

  function terminarEdicion() {
    setZonaEnEdicion(null)
    limpiarAvisos()
  }

  /** Guarda la zona. Si el backend avisa ZONA_SUPERPUESTA (409) se muestra la advertencia (CP-08). */
  async function guardar(datos, confirmarSuperposicion) {
    setGuardando(true)
    limpiarAvisos()
    try {
      if (zonaEnEdicion) {
        await actualizarZona(zonaEnEdicion.id, datos, confirmarSuperposicion)
        setMensaje(`Zona "${datos.nombre}" actualizada.`)
      } else {
        await crearZona(datos, confirmarSuperposicion)
        setMensaje(`Zona "${datos.nombre}" creada.`)
      }
      // Primero se trae la lista nueva y recién después se reinicia el formulario (y su mapa),
      // para que el mapa de referencia nunca se dibuje con las zonas anteriores.
      await cargar()
      setZonaEnEdicion(null)
      setVersion((v) => v + 1)
    } catch (e) {
      if (estadoHttp(e) === 409 && codigoDeError(e) === 'ZONA_SUPERPUESTA') {
        setAdvertencia(mensajeDeError(e))
      } else {
        setErrorForm(mensajeDeError(e))
      }
    } finally {
      setGuardando(false)
    }
  }

  const zonasReferencia = zonas.filter((zona) => zona.activa && zona.id !== zonaEnEdicion?.id)

  return (
    <section>
      <header className="encabezado">
        <h2>Zonas</h2>
        {zonaEnEdicion && (
          <button type="button" className="secundario" onClick={terminarEdicion}>
            Nueva zona
          </button>
        )}
      </header>

      {mensaje && (
        <p className="mensaje-ok" role="status">
          {mensaje}
        </p>
      )}
      {errorLista && (
        <p className="mensaje-error" role="alert">
          {errorLista}
        </p>
      )}

      <div className="dos-columnas">
        <div>
          <table className="tabla">
            <caption className="solo-lectores">Zonas de reparto</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Nombre</th>
                <th scope="col">Activa</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((zona) => (
                <tr key={zona.id}>
                  <td>{zona.id}</td>
                  <td>{zona.nombre}</td>
                  <td>{zona.activa ? 'Sí' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Editar zona ${zona.nombre}`}
                      onClick={() => editar(zona)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {zonas.length === 0 && (
                <tr>
                  <td colSpan={4} className="vacio">
                    No hay zonas configuradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tarjeta">
          <ZonaForm
            key={`${zonaEnEdicion?.id ?? 'nueva'}-${version}`}
            zona={zonaEnEdicion}
            zonasReferencia={zonasReferencia}
            onGuardar={guardar}
            onCancelar={zonaEnEdicion ? terminarEdicion : undefined}
            onEditar={limpiarAvisos}
            guardando={guardando}
            error={errorForm}
            advertencia={advertencia}
          />
        </div>
      </div>
    </section>
  )
}
