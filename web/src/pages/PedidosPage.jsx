import { useCallback, useEffect, useState } from 'react'
import { crearPedido, editarPedido, eliminarPedido, listarPedidos } from '../api/pedidosApi'
import { listarZonas } from '../api/zonasApi'
import { mensajeDeError, mensajeDeErrorPedido } from '../utils/errores'
import EstadoBadge from '../components/EstadoBadge'
import PedidoForm from '../components/PedidoForm'
import { ESTADOS_PEDIDO } from '../utils/estados'

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([])
  const [total, setTotal] = useState(0)
  const [zonas, setZonas] = useState([])
  const [filtros, setFiltros] = useState({ fecha: '', zonaId: '', estado: '' })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [pedidoEnEdicion, setPedidoEnEdicion] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [errorLista, setErrorLista] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const resultado = await listarPedidos({ ...filtros, size: 200 })
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

  useEffect(() => {
    listarZonas()
      .then(setZonas)
      .catch((error) => setErrorLista(mensajeDeError(error)))
  }, [])

  const zonasActivas = zonas.filter((zona) => zona.activa)

  function abrirNuevo() {
    setPedidoEnEdicion(null)
    setErrorForm(null)
    setMensaje(null)
    setMostrarForm(true)
  }

  function abrirEdicion(pedido) {
    setPedidoEnEdicion(pedido)
    setErrorForm(null)
    setMensaje(null)
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setPedidoEnEdicion(null)
    setErrorForm(null)
  }

  async function guardar(datos) {
    setEnviando(true)
    setErrorForm(null)
    try {
      if (pedidoEnEdicion) {
        await editarPedido(pedidoEnEdicion.id, datos)
        setMensaje(`Pedido ${pedidoEnEdicion.id} actualizado.`)
      } else {
        await crearPedido(datos)
        setMensaje('Pedido registrado.')
      }
      cerrarForm()
      await cargar()
    } catch (error) {
      setErrorForm(mensajeDeErrorPedido(error)) // 422 CP-03 / CP-04, 409 CP-05
      if (pedidoEnEdicion) await cargar() // si ya no era PENDIENTE, la tabla debe reflejarlo
    } finally {
      setEnviando(false)
    }
  }

  async function eliminar(pedido) {
    if (!window.confirm(`¿Eliminar el pedido ${pedido.id}?`)) return
    setMensaje(null)
    try {
      await eliminarPedido(pedido.id)
      setMensaje(`Pedido ${pedido.id} eliminado.`)
      await cargar()
    } catch (error) {
      setErrorLista(mensajeDeErrorPedido(error))
      await cargar()
    }
  }

  function cambiarFiltro(evento) {
    setFiltros((anteriores) => ({ ...anteriores, [evento.target.name]: evento.target.value }))
  }

  return (
    <section>
      <header className="encabezado">
        <h2>Pedidos</h2>
        {mostrarForm ? (
          <button type="button" className="secundario" onClick={cerrarForm}>
            Cerrar formulario
          </button>
        ) : (
          <button type="button" onClick={abrirNuevo}>
            Nuevo pedido
          </button>
        )}
      </header>

      {mensaje && (
        <p className="mensaje-ok" role="status">
          {mensaje}
        </p>
      )}

      {mostrarForm && (
        <div className="tarjeta">
          <h3>{pedidoEnEdicion ? `Editar pedido ${pedidoEnEdicion.id}` : 'Nuevo pedido'}</h3>
          <PedidoForm
            key={pedidoEnEdicion?.id ?? 'nuevo'}
            pedido={pedidoEnEdicion}
            zonas={zonasActivas}
            onSubmit={guardar}
            onCancelar={cerrarForm}
            enviando={enviando}
            error={errorForm}
          />
        </div>
      )}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="filtroFecha">Fecha de entrega</label>
          <input id="filtroFecha" name="fecha" type="date" value={filtros.fecha} onChange={cambiarFiltro} />
        </div>
        <div className="campo">
          <label htmlFor="filtroZona">Zona</label>
          <select id="filtroZona" name="zonaId" value={filtros.zonaId} onChange={cambiarFiltro}>
            <option value="">Todas</option>
            {zonas.map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="filtroEstado">Estado</label>
          <select id="filtroEstado" name="estado" value={filtros.estado} onChange={cambiarFiltro}>
            <option value="">Todos</option>
            {ESTADOS_PEDIDO.map((estado) => (
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

      {errorLista && (
        <p className="mensaje-error" role="alert">
          {errorLista}
        </p>
      )}
      <table className="tabla">
        <caption className="solo-lectores">Lista de pedidos</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Cliente</th>
            <th scope="col">Dirección</th>
            <th scope="col">Zona</th>
            <th scope="col">Entrega</th>
            <th scope="col">Registro</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
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
              <td className="celda-acciones">
                {pedido.estado === 'PENDIENTE' && (
                  <>
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Editar pedido ${pedido.id}`}
                      onClick={() => abrirEdicion(pedido)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="peligro"
                      aria-label={`Eliminar pedido ${pedido.id}`}
                      onClick={() => eliminar(pedido)}
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={8} className="vacio">
                No hay pedidos con esos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
