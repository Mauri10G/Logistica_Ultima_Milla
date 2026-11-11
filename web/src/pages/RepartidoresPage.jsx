import { useCallback, useEffect, useState } from 'react'
import { cambiarDisponibilidad, crearRepartidor, listarRepartidores } from '../api/repartidoresApi'
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

  const cargar = useCallback(async () => {
    try {
      setRepartidores(await listarRepartidores())
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
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
      <header className="encabezado">
        <h2>Repartidores</h2>
        <button type="button" onClick={abrirForm}>
          Nuevo repartidor
        </button>
      </header>

      {mensaje && (
        <p className="mensaje-ok" role="status">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <table className="tabla">
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
          {repartidores.length === 0 && (
            <tr>
              <td colSpan={5} className="vacio">
                No hay repartidores registrados.
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
                <button type="button" className="secundario" onClick={() => alternar(repartidor)}>
                  {repartidor.disponible ? 'Disponible · marcar no disponible' : 'No disponible · marcar disponible'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {mostrarForm && (
        <Modal titulo="Nuevo repartidor" onCerrar={cerrarForm}>
          <form className="formulario" onSubmit={crear} aria-label="Nuevo repartidor">
            <div className="campo">
              <label htmlFor="repNombres">Nombres</label>
              <input id="repNombres" value={nombres} onChange={(e) => setNombres(e.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="repTelefono">Teléfono</label>
              <input id="repTelefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
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
                {enviando ? 'Guardando…' : 'Agregar repartidor'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
