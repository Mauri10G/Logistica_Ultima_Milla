import { useEffect, useState } from 'react'
import { obtenerHistorial } from '../api/seguimientoApi'
import { mensajeDeError } from '../utils/errores'
import { formatearFechaHora } from '../utils/formatos'
import EstadoBadge from './EstadoBadge'
import { LineaTiempoHistorial } from './HistorialPedido'
import Modal from './Modal'

const PRIORIDADES = { NORMAL: 'Normal', ALTA: 'Alta' }

function textoRuta(pedido) {
  if (pedido.rutaId == null) return 'Sin ruta asignada'
  return pedido.ordenEnRuta == null ? `Ruta ${pedido.rutaId}` : `Ruta ${pedido.rutaId} · parada ${pedido.ordenEnRuta}`
}

/**
 * Detalle de solo lectura de un pedido: sus datos, la ruta asignada y su historial de estados.
 * El historial se pide al abrirse (GET /api/seguimiento/pedidos/{id}/historial).
 */
export default function DetallePedido({ pedido, onCerrar }) {
  const [historial, setHistorial] = useState(null)
  const [errorHistorial, setErrorHistorial] = useState(null)

  useEffect(() => {
    let vigente = true
    obtenerHistorial(pedido.id)
      .then((datos) => vigente && setHistorial(datos))
      .catch((e) => vigente && setErrorHistorial(mensajeDeError(e)))
    return () => {
      vigente = false
    }
  }, [pedido.id])

  const datos = [
    ['Cliente', pedido.clienteNombres],
    ['Teléfono', pedido.clienteTelefono],
    ['Dirección', pedido.direccion],
    ['Zona', pedido.zonaNombre],
    ['Entrega', `${pedido.fechaEntrega ?? ''} ${pedido.horaEntrega?.slice(0, 5) ?? ''}`.trim()],
    ['Registro', formatearFechaHora(pedido.fechaRegistro)],
    ['Prioridad', PRIORIDADES[pedido.prioridad] ?? pedido.prioridad],
    ['Ruta asignada', textoRuta(pedido)],
  ]

  return (
    <Modal titulo={`Pedido ${pedido.id}`} onCerrar={onCerrar}>
      <dl className="detalle-datos">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor || '—'}</dd>
          </div>
        ))}
        <div>
          <dt>Estado</dt>
          <dd>
            <EstadoBadge estado={pedido.estado} />
          </dd>
        </div>
      </dl>
      <h3 className="detalle-subtitulo">Historial de estados</h3>
      <LineaTiempoHistorial historial={historial} error={errorHistorial} />
      <div className="acciones">
        <button type="button" className="secundario" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
