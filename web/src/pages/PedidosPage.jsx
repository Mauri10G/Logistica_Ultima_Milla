import { PackageSearch, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { crearPedido, editarPedido, eliminarPedido, listarPedidos, obtenerHoraServidor } from '../api/pedidosApi'
import { listarZonas } from '../api/zonasApi'
import { mensajeDeError, mensajeDeErrorPedido } from '../utils/errores'
import Avisos from '../components/Avisos'
import { FilasCarga } from '../components/Cargando'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoBadge from '../components/EstadoBadge'
import EstadoVacio from '../components/EstadoVacio'
import Modal from '../components/Modal'
import PedidoForm from '../components/PedidoForm'
import { ESTADOS_PEDIDO } from '../utils/estados'
import { horaServidorValida } from '../utils/validacionPedido'

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([])
  const [total, setTotal] = useState(0)
  const [zonas, setZonas] = useState([])
  const [horaServidor, setHoraServidor] = useState(null)
  const consultaHora = useRef(0)
  const [filtros, setFiltros] = useState({ fecha: '', zonaId: '', estado: '' })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [pedidoEnEdicion, setPedidoEnEdicion] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [errorLista, setErrorLista] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    try {
      const resultado = await listarPedidos({ ...filtros, size: 200 })
      setPedidos(resultado.pedidos)
      setTotal(resultado.total)
      setErrorLista(null)
    } catch (error) {
      setErrorLista(mensajeDeError(error))
    } finally {
      setCargando(false)
    }
  }, [filtros])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Las zonas se vuelven a pedir cada vez que se abre el formulario: así el mapa de referencia
  // refleja las zonas creadas, editadas o dadas de baja desde la pantalla de Zonas.
  const cargarZonas = useCallback(async () => {
    try {
      setZonas(await listarZonas())
    } catch (error) {
      setErrorLista(mensajeDeError(error))
    }
  }, [])

  useEffect(() => {
    cargarZonas()
  }, [cargarZonas])

  const zonasActivas = zonas.filter((zona) => zona.activa)

  // La hora se pide al servidor cada vez que se abre el formulario: la fecha mínima y la hora mínima salen de ella,
  // no del reloj del computador (que el usuario puede cambiar). Si no responde, el formulario no valida fecha ni
  // hora y el backend decide y explica el rechazo.
  async function cargarHoraServidor() {
    const consulta = ++consultaHora.current
    setHoraServidor(null)
    let hora = null
    try {
      const datos = await obtenerHoraServidor()
      if (horaServidorValida(datos)) hora = datos
    } catch {
      hora = null
    }
    if (consulta === consultaHora.current) setHoraServidor(hora)
  }

  function abrirNuevo() {
    setPedidoEnEdicion(null)
    setErrorForm(null)
    setMensaje(null)
    setMostrarForm(true)
    cargarZonas()
    cargarHoraServidor()
  }

  function abrirEdicion(pedido) {
    setPedidoEnEdicion(pedido)
    setErrorForm(null)
    setMensaje(null)
    setMostrarForm(true)
    cargarZonas()
    cargarHoraServidor()
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
      await cargar() // recargar limpia el error de la lista, por eso se muestra después
      setErrorLista(mensajeDeErrorPedido(error))
    }
  }

  function cambiarFiltro(evento) {
    setFiltros((anteriores) => ({ ...anteriores, [evento.target.name]: evento.target.value }))
  }

  return (
    <section>
      <EncabezadoPagina
        titulo="Pedidos"
        descripcion="Registre los pedidos de entrega y filtre por fecha, zona o estado."
      >
        <button type="button" onClick={abrirNuevo}>
          <Plus size={18} aria-hidden="true" />
          Nuevo pedido
        </button>
      </EncabezadoPagina>

      <Avisos
        mensaje={mensaje}
        error={errorLista}
        onCerrarMensaje={() => setMensaje(null)}
        onCerrarError={() => setErrorLista(null)}
      />

      {mostrarForm && (
        <Modal titulo={pedidoEnEdicion ? `Editar pedido ${pedidoEnEdicion.id}` : 'Nuevo pedido'} onCerrar={cerrarForm}>
          <PedidoForm
            key={pedidoEnEdicion?.id ?? 'nuevo'}
            pedido={pedidoEnEdicion}
            zonas={zonasActivas}
            horaServidor={horaServidor}
            onSubmit={guardar}
            onCancelar={cerrarForm}
            enviando={enviando}
            error={errorForm}
          />
        </Modal>
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

      <div className="tabla-contenedor">
        <table className="tabla" aria-busy={cargando}>
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
            {cargando && <FilasCarga columnas={8} />}
            {pedidos.map((pedido) => (
              <tr key={pedido.id}>
                <td>{pedido.id}</td>
                <td>{pedido.clienteNombres}</td>
                <td>{pedido.direccion}</td>
                <td>{pedido.zonaNombre}</td>
                <td className="celda-fecha">
                  {pedido.fechaEntrega} {pedido.horaEntrega?.slice(0, 5)}
                </td>
                <td className="celda-fecha">{pedido.fechaRegistro?.slice(0, 16).replace('T', ' ')}</td>
                <td>
                  <EstadoBadge estado={pedido.estado} />
                </td>
                <td className="celda-acciones">
                  {pedido.estado === 'PENDIENTE' && (
                    <>
                      <button
                        type="button"
                        className="secundario pequeno"
                        aria-label={`Editar pedido ${pedido.id}`}
                        onClick={() => abrirEdicion(pedido)}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="peligro pequeno"
                        aria-label={`Eliminar pedido ${pedido.id}`}
                        onClick={() => eliminar(pedido)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!cargando && pedidos.length === 0 && (
              <tr>
                <td colSpan={8} className="vacio">
                  <EstadoVacio
                    icono={PackageSearch}
                    titulo="No hay pedidos con esos filtros."
                    ayuda="Cambie la fecha, la zona o el estado, o registre un nuevo pedido."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
