import { MapPinned, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { actualizarZona, crearZona, listarZonas } from '../api/zonasApi'
import { codigoDeError, estadoHttp, mensajeDeError } from '../utils/errores'
import Avisos from '../components/Avisos'
import { FilasCarga } from '../components/Cargando'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoVacio from '../components/EstadoVacio'
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
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    try {
      setZonas(await listarZonas())
      setErrorLista(null)
    } catch (e) {
      setErrorLista(mensajeDeError(e))
    } finally {
      setCargando(false)
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
      <EncabezadoPagina
        titulo="Zonas"
        descripcion="Defina las zonas de reparto dibujando su polígono en el mapa; los pedidos se agrupan por zona."
      >
        {zonaEnEdicion && (
          <button type="button" className="secundario" onClick={terminarEdicion}>
            <Plus size={18} aria-hidden="true" />
            Nueva zona
          </button>
        )}
      </EncabezadoPagina>

      <Avisos
        mensaje={mensaje}
        error={errorLista}
        onCerrarMensaje={() => setMensaje(null)}
        onCerrarError={() => setErrorLista(null)}
      />

      <div className="dos-columnas">
        <div className="tabla-contenedor">
          <table className="tabla" aria-busy={cargando}>
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
              {cargando && <FilasCarga columnas={4} />}
              {zonas.map((zona) => (
                <tr key={zona.id}>
                  <td>{zona.id}</td>
                  <td>{zona.nombre}</td>
                  <td>
                    <span className={zona.activa ? 'pastilla pastilla-ok' : 'pastilla'}>{zona.activa ? 'Sí' : 'No'}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secundario pequeno"
                      aria-label={`Editar zona ${zona.nombre}`}
                      onClick={() => editar(zona)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && zonas.length === 0 && (
                <tr>
                  <td colSpan={4} className="vacio">
                    <EstadoVacio
                      icono={MapPinned}
                      titulo="No hay zonas configuradas."
                      ayuda="Dibuje la primera zona en el mapa del formulario."
                    />
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
