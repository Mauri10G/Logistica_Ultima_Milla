import { useState } from 'react'
import { fechaIso } from '../hooks/fechas'

const VALORES_INICIALES = {
  clienteNombres: '',
  clienteTelefono: '',
  clienteEmail: '',
  direccion: '',
  latitud: '',
  longitud: '',
  fechaEntrega: '',
  horaEntrega: '',
  prioridad: 'NORMAL',
}

/**
 * Formulario de nuevo pedido. Es presentacional: no llama a la API, entrega los datos a `onSubmit`.
 * Todos los campos tienen <label> asociado para poder encontrarlos con getByLabelText.
 */
export default function PedidoForm({ onSubmit, enviando = false, error = null }) {
  const [valores, setValores] = useState({ ...VALORES_INICIALES, fechaEntrega: fechaIso(0) })

  function cambiar(evento) {
    const { name, value } = evento.target
    setValores((anteriores) => ({ ...anteriores, [name]: value }))
  }

  function enviar(evento) {
    evento.preventDefault()
    const datos = {
      clienteNombres: valores.clienteNombres.trim(),
      clienteTelefono: valores.clienteTelefono.trim(),
      direccion: valores.direccion.trim(),
      latitud: Number(valores.latitud),
      longitud: Number(valores.longitud),
      fechaEntrega: valores.fechaEntrega,
      horaEntrega: valores.horaEntrega,
      prioridad: valores.prioridad,
    }
    if (valores.clienteEmail.trim()) datos.clienteEmail = valores.clienteEmail.trim()
    onSubmit(datos)
  }

  return (
    <form className="formulario" onSubmit={enviar} aria-label="Nuevo pedido">
      <div className="campo">
        <label htmlFor="clienteNombres">Nombres del cliente</label>
        <input id="clienteNombres" name="clienteNombres" value={valores.clienteNombres} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="clienteTelefono">Teléfono</label>
        <input id="clienteTelefono" name="clienteTelefono" value={valores.clienteTelefono} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="clienteEmail">Email (opcional)</label>
        <input id="clienteEmail" name="clienteEmail" type="email" value={valores.clienteEmail} onChange={cambiar} />
      </div>
      <div className="campo ancho-completo">
        <label htmlFor="direccion">Dirección de entrega</label>
        <input id="direccion" name="direccion" value={valores.direccion} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="latitud">Latitud</label>
        <input id="latitud" name="latitud" type="number" step="any" value={valores.latitud} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="longitud">Longitud</label>
        <input id="longitud" name="longitud" type="number" step="any" value={valores.longitud} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="fechaEntrega">Fecha de entrega</label>
        <input id="fechaEntrega" name="fechaEntrega" type="date" value={valores.fechaEntrega} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="horaEntrega">Hora aproximada</label>
        <input id="horaEntrega" name="horaEntrega" type="time" value={valores.horaEntrega} onChange={cambiar} required />
      </div>
      <div className="campo">
        <label htmlFor="prioridad">Prioridad</label>
        <select id="prioridad" name="prioridad" value={valores.prioridad} onChange={cambiar}>
          <option value="NORMAL">Normal</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </select>
      </div>

      {error && (
        <p className="mensaje-error ancho-completo" role="alert">
          {error}
        </p>
      )}
      <div className="acciones ancho-completo">
        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Registrar pedido'}
        </button>
      </div>
    </form>
  )
}
