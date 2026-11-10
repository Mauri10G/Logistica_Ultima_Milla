import { useCallback, useEffect, useState } from 'react'
import { crearPedido, listarPedidos } from '../api/pedidosApi'
import { mensajeDeError } from '../api/client'
import EstadoBadge from '../components/EstadoBadge'
import PedidoForm from '../components/PedidoForm'

const ESTADOS = ['PENDIENTE', 'ASIGNADO', 'RECOGIDO', 'EN_CAMINO', 'ENTREGADO']

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([])
  const [total, setTotal] = useState(0)
  const [filtros, setFiltros] = useState({ fecha: '', estado: '' })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [errorLista, setErrorLista] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const resultado = await listarPedidos({ fecha: filtros.fecha, estado: filtros.estado, size: 200 })
      setPedidos(resultado.pedidos)
      setTotal(resultado.total)
      setErrorLista(null)
    } catch (error) {
      setErrorLista(mensajeDeError(error))
    }
  }, [filtros])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function registrar(datos) {
    setEnviando(true)
    setErrorForm(null)
    try {
      await crearPedido(datos)
      setMostrarForm(false)
      await cargar()
    } catch (error) {
      setErrorForm(mensajeDeError(error)) // p. ej. 422 "La dirección no corresponde a ninguna zona configurada"
    } finally {
      setEnviando(false)
    }
  }

  function cambiarFiltro(evento) {
    setFiltros((anteriores) => ({ ...anteriores, [evento.target.name]: evento.target.value }))
  }

  return (
    <section>
      <header className="encabezado">
        <h2>Pedidos</h2>
        <button type="button" onClick={() => setMostrarForm((visible) => !visible)}>
          {mostrarForm ? 'Cerrar formulario' : 'Nuevo pedido'}
        </button>
      </header>

      {mostrarForm && (
        <div className="tarjeta">
          <h3>Nuevo pedido</h3>
          <PedidoForm onSubmit={registrar} enviando={enviando} error={errorForm} />
        </div>
      )}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="filtroFecha">Fecha de entrega</label>
          <input id="filtroFecha" name="fecha" type="date" value={filtros.fecha} onChange={cambiarFiltro} />
        </div>
        <div className="campo">
          <label htmlFor="filtroEstado">Estado</label>
          <select id="filtroEstado" name="estado" value={filtros.estado} onChange={cambiarFiltro}>
            <option value="">Todos</option>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
        <p className="total">
          {total} pedido(s){total > pedidos.length ? ` (mostrando ${pedidos.length})` : ''}
        </p>
      </div>

      {errorLista && <p className="mensaje-error">{errorLista}</p>}
      <table className="tabla">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Dirección</th>
            <th>Zona</th>
            <th>Entrega</th>
            <th>Registro</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido) => (
            <tr key={pedido.id}>
              <td>{pedido.id}</td>
              <td>{pedido.clienteNombres}</td>
              <td>{pedido.direccion}</td>
              <td>{pedido.zonaNombre}</td>
              <td>
                {pedido.fechaEntrega} {pedido.horaEntrega?.slice(0, 5)}
              </td>
              <td>{pedido.fechaRegistro?.slice(0, 16).replace('T', ' ')}</td>
              <td>
                <EstadoBadge estado={pedido.estado} />
              </td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={7} className="vacio">
                No hay pedidos con esos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
