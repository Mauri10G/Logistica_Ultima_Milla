import { Plus, Truck, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cambiarDisponibilidad, crearRepartidor, listarRepartidores } from '../api/repartidoresApi'
import Avisos from '../components/Avisos'
import { FilasCarga } from '../components/Cargando'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoVacio from '../components/EstadoVacio'
import Modal from '../components/Modal'
import { mensajeDeError } from '../utils/errores'

export default function RepartidoresPage() {
  const [repartidores, setRepartidores] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombres, setNombres] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState(null)
  const [errorForm, setErrorForm] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    try {
      setRepartidores(await listarRepartidores())
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function abrirForm() {
    setNombres('')
    setTelefono('')
    setErrorForm(null)
    setMensaje(null)
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setErrorForm(null)
  }

  async function crear(evento) {
    evento.preventDefault()
    setErrorForm(null)
    setEnviando(true)
    try {
      await crearRepartidor({ nombres, telefono })
      setMensaje(`Repartidor ${nombres} agregado.`)
      cerrarForm()
      await cargar()
    } catch (e) {
      setErrorForm(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  async function alternar(repartidor) {
    try {
      await cambiarDisponibilidad(repartidor.id, !repartidor.disponible)
      await cargar()
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  return (
    <section>
      <EncabezadoPagina
        titulo="Repartidores"
        descripcion="Personal de reparto y su disponibilidad para que se les asignen rutas."
      >
        <button type="button" onClick={abrirForm}>
          <Plus size={18} aria-hidden="true" />
          Nuevo repartidor
        </button>
      </EncabezadoPagina>

      <Avisos
        mensaje={mensaje}
        error={error}
        onCerrarMensaje={() => setMensaje(null)}
        onCerrarError={() => setError(null)}
      />
      <div className="tabla-contenedor">
        <table className="tabla" aria-busy={cargando}>
          <caption className="solo-lectores">Repartidores</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Nombres</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Capacidad</th>
              <th scope="col">Disponible</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <FilasCarga columnas={5} />}
            {!cargando && repartidores.length === 0 && (
              <tr>
                <td colSpan={5} className="vacio">
                  <EstadoVacio
                    icono={Truck}
                    titulo="No hay repartidores registrados."
                    ayuda="Agregue un repartidor para poder asignarle rutas."
                  />
                </td>
              </tr>
            )}
            {repartidores.map((repartidor) => (
              <tr key={repartidor.id}>
                <td>{repartidor.id}</td>
                <td>{repartidor.nombres}</td>
                <td>{repartidor.telefono}</td>
                <td>{repartidor.capacidadMaxima}</td>
                <td>
                  <button
                    type="button"
                    className={repartidor.disponible ? 'secundario disponibilidad disponible' : 'secundario disponibilidad'}
                    onClick={() => alternar(repartidor)}
                  >
                    {repartidor.disponible ? 'Disponible · marcar no disponible' : 'No disponible · marcar disponible'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarForm && (
        <Modal titulo="Nuevo repartidor" onCerrar={cerrarForm}>
          <form className="formulario" onSubmit={crear} aria-label="Nuevo repartidor">
            <div className="campo">
              <label htmlFor="repNombres">Nombres</label>
              <input
                id="repNombres"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                aria-describedby="ayudaRepNombres"
                required
              />
              <p id="ayudaRepNombres" className="ayuda">
                Nombre completo, como aparecerá en las rutas.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="repTelefono">Teléfono</label>
              <input
                id="repTelefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                aria-describedby="ayudaRepTelefono"
                required
              />
              <p id="ayudaRepTelefono" className="ayuda">
                Número de contacto del repartidor.
              </p>
            </div>
            {errorForm && (
              <p className="mensaje-error ancho-completo" role="alert">
                {errorForm}
              </p>
            )}
            <div className="acciones ancho-completo">
              <button type="button" className="secundario" onClick={cerrarForm}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando}>
                <UserPlus size={18} aria-hidden="true" />
                {enviando ? 'Guardando…' : 'Agregar repartidor'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
