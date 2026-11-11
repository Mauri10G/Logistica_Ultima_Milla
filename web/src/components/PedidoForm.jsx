import { useState } from 'react'
import { fechaIso } from '../hooks/fechas'
import { validarPedido } from '../utils/validacionPedido'
import SelectorUbicacion from './SelectorUbicacion'

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

function valoresDesde(pedido) {
  if (!pedido) return { ...VALORES_INICIALES, fechaEntrega: fechaIso(0) }
  return {
    clienteNombres: pedido.clienteNombres ?? '',
    clienteTelefono: pedido.clienteTelefono ?? '',
    clienteEmail: '',
    direccion: pedido.direccion ?? '',
    latitud: String(pedido.latitud),
    longitud: String(pedido.longitud),
    fechaEntrega: pedido.fechaEntrega ?? '',
    horaEntrega: pedido.horaEntrega?.slice(0, 5) ?? '',
    prioridad: pedido.prioridad ?? 'NORMAL',
  }
}

/**
 * Formulario de pedido (alta y edición). Es presentacional: no llama a la API, entrega los datos a `onSubmit`.
 * Latitud y longitud son de solo lectura: se llenan con un clic en el mapa. Todos los campos tienen <label>.
 *
 * @param {object} [pedido] si viene, el formulario edita ese pedido (PedidoResponse)
 * @param {object[]} [zonas] zonas activas que se muestran como referencia en el mapa
 */
export default function PedidoForm({ onSubmit, onCancelar, enviando = false, error = null, zonas = [], pedido = null }) {
  const [valores, setValores] = useState(() => valoresDesde(pedido))
  const [errores, setErrores] = useState({})
  const editando = pedido !== null

  function cambiar(evento) {
    const { name, value } = evento.target
    setValores((anteriores) => ({ ...anteriores, [name]: value }))
    setErrores((anteriores) => ({ ...anteriores, [name]: undefined }))
  }

  function elegirUbicacion(latitud, longitud) {
    setValores((anteriores) => ({
      ...anteriores,
      latitud: latitud.toFixed(6),
      longitud: longitud.toFixed(6),
    }))
    setErrores((anteriores) => ({ ...anteriores, ubicacion: undefined }))
  }

  function construirDatos() {
    const nombres = valores.clienteNombres.trim()
    const telefono = valores.clienteTelefono.trim()
    const datos = {
      direccion: valores.direccion.trim(),
      latitud: Number(valores.latitud),
      longitud: Number(valores.longitud),
      fechaEntrega: valores.fechaEntrega,
      horaEntrega: valores.horaEntrega,
      prioridad: valores.prioridad,
    }
    // Al editar, si los datos del cliente no cambiaron se envía solo su id (así no se pierde su email).
    const clienteSinCambios =
      editando && nombres === pedido.clienteNombres && telefono === pedido.clienteTelefono && !valores.clienteEmail.trim()
    if (clienteSinCambios) {
      datos.clienteId = pedido.clienteId
    } else {
      datos.clienteNombres = nombres
      datos.clienteTelefono = telefono
      if (valores.clienteEmail.trim()) datos.clienteEmail = valores.clienteEmail.trim()
    }
    return datos
  }

  function enviar(evento) {
    evento.preventDefault()
    const encontrados = validarPedido(valores)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return
    onSubmit(construirDatos())
  }

  return (
    <form className="formulario" onSubmit={enviar} aria-label={editando ? 'Editar pedido' : 'Nuevo pedido'}>
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

      <div className="ancho-completo">
        <SelectorUbicacion
          posicion={valores.latitud === '' ? null : [Number(valores.latitud), Number(valores.longitud)]}
          onSeleccionar={elegirUbicacion}
          zonas={zonas}
        />
        <p className="ayuda">Haga clic en el mapa para colocar el marcador de entrega.</p>
      </div>
      <div className="campo">
        <label htmlFor="latitud">Latitud</label>
        <input id="latitud" name="latitud" value={valores.latitud} readOnly aria-invalid={Boolean(errores.ubicacion)} />
      </div>
      <div className="campo">
        <label htmlFor="longitud">Longitud</label>
        <input id="longitud" name="longitud" value={valores.longitud} readOnly aria-invalid={Boolean(errores.ubicacion)} />
      </div>
      {errores.ubicacion && (
        <p className="mensaje-error ancho-completo" role="alert">
          {errores.ubicacion}
        </p>
      )}

      <div className="campo">
        <label htmlFor="fechaEntrega">Fecha de entrega</label>
        <input
          id="fechaEntrega"
          name="fechaEntrega"
          type="date"
          value={valores.fechaEntrega}
          onChange={cambiar}
          required
          aria-invalid={Boolean(errores.fechaEntrega)}
          aria-describedby={errores.fechaEntrega ? 'errorFechaEntrega' : undefined}
        />
        {errores.fechaEntrega && (
          <span id="errorFechaEntrega" className="error-campo" role="alert">
            {errores.fechaEntrega}
          </span>
        )}
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
        {onCancelar && (
          <button type="button" className="secundario" onClick={onCancelar}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar pedido'}
        </button>
      </div>
    </form>
  )
}
