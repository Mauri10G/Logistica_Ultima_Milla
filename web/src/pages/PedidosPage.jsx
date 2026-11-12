import { Eye, PackageSearch, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { crearPedido, editarPedido, eliminarPedido, listarPedidos, obtenerHoraServidor } from '../api/pedidosApi'
import { listarZonas } from '../api/zonasApi'
import { mensajeDeError, mensajeDeErrorPedido } from '../utils/errores'
import Avisos from '../components/Avisos'
import Buscador from '../components/Buscador'
import CandadoAyuda from '../components/CandadoAyuda'
import DetallePedido from '../components/DetallePedido'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoBadge from '../components/EstadoBadge'
import EstadoVacio from '../components/EstadoVacio'
import Modal from '../components/Modal'
import PedidoForm from '../components/PedidoForm'
import Tabla from '../components/Tabla'
import { fechaIso } from '../hooks/fechas'
import { coincide } from '../utils/busqueda'
import { ESTADOS_PEDIDO, ETIQUETAS_ESTADO } from '../utils/estados'
import { horaServidorValida } from '../utils/validacionPedido'

const COLUMNAS = [
  { clave: 'id', titulo: '#' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'direccion', titulo: 'Dirección' },
  { clave: 'zona', titulo: 'Zona' },
  { clave: 'entrega', titulo: 'Entrega' },
  { clave: 'registro', titulo: 'Registro' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones' },
]

// Valor por el que ordena cada columna. El estado ordena por su lugar en el flujo, no por orden alfabético.
const VALORES = {
  id: (pedido) => pedido.id,
  cliente: (pedido) => pedido.clienteNombres,
  direccion: (pedido) => pedido.direccion,
  zona: (pedido) => pedido.zonaNombre,
  entrega: (pedido) => (pedido.fechaEntrega ? `${pedido.fechaEntrega} ${pedido.horaEntrega ?? ''}` : null),
  registro: (pedido) => pedido.fechaRegistro,
  estado: (pedido) => ESTADOS_PEDIDO.indexOf(pedido.estado),
}

// Al cargar o recargar, la tabla viene por número de pedido de menor a mayor.
const ORDEN_INICIAL = { clave: 'id', direccion: 'asc' }

/** Explica por qué un pedido que no está PENDIENTE no se puede editar ni eliminar (CP-05). */
function ayudaNoEditable(estado) {
  return `Solo se edita o elimina un pedido pendiente; este ya está ${(ETIQUETAS_ESTADO[estado] ?? estado).toLowerCase()}.`
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([])
  const [total, setTotal] = useState(0)
  const [zonas, setZonas] = useState([])
  const [horaServidor, setHoraServidor] = useState(null)
  const consultaHora = useRef(0)
  const [filtros, setFiltros] = useState(() => ({ fecha: fechaIso(0), zonaId: '', estado: '' }))
  const [busqueda, setBusqueda] = useState('')
  const [pedidoEnDetalle, setPedidoEnDetalle] = useState(null)
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

  function elegirFecha(fecha) {
    setFiltros((anteriores) => ({ ...anteriores, fecha }))
  }

  const hoy = fechaIso(0)
  const manana = fechaIso(1)
  const visibles = pedidos.filter((pedido) => coincide(busqueda, pedido.clienteNombres, pedido.direccion))

  return (
    <section>
      <EncabezadoPagina
        titulo="Pedidos"
        descripcion="Registre los pedidos de entrega, filtre por fecha, zona o estado y busque por cliente o dirección."
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

      {pedidoEnDetalle && <DetallePedido pedido={pedidoEnDetalle} onCerrar={() => setPedidoEnDetalle(null)} />}

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
        <fieldset className="conjunto grupo-botones" aria-label="Atajos de fecha">
          <button type="button" className="secundario" aria-pressed={filtros.fecha === hoy} onClick={() => elegirFecha(hoy)}>
            Hoy
          </button>
          <button type="button" className="secundario" aria-pressed={filtros.fecha === manana} onClick={() => elegirFecha(manana)}>
            Mañana
          </button>
          <button type="button" className="secundario" aria-pressed={filtros.fecha === ''} onClick={() => elegirFecha('')}>
            Todas
          </button>
        </fieldset>
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
        <Buscador
          id="buscarPedido"
          etiqueta="Buscar por cliente o dirección"
          valor={busqueda}
          onCambiar={setBusqueda}
          placeholder="Nombre o calle"
        />
        <p className="total">
          {total} pedido(s){total > pedidos.length ? ` (mostrando ${pedidos.length})` : ''}
        </p>
      </div>

      <Tabla
        titulo="Lista de pedidos"
        columnas={COLUMNAS}
        valores={VALORES}
        filas={visibles}
        cargando={cargando}
        ordenInicial={ORDEN_INICIAL}
        reiniciarCon={[filtros, busqueda]}
        vacio={
          <EstadoVacio
            icono={PackageSearch}
            titulo="No hay pedidos con esos filtros."
            ayuda="Cambie la fecha, la zona, el estado o la búsqueda, o registre un nuevo pedido."
          />
        }
        renderFila={(pedido) => (
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
              <button
                type="button"
                className="secundario pequeno"
                aria-label={`Ver pedido ${pedido.id}`}
                onClick={() => setPedidoEnDetalle(pedido)}
              >
                <Eye size={14} aria-hidden="true" />
                Ver
              </button>
              {pedido.estado === 'PENDIENTE' ? (
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
              ) : (
                <CandadoAyuda etiqueta={`Pedido ${pedido.id} bloqueado`} texto={ayudaNoEditable(pedido.estado)} />
              )}
            </td>
          </tr>
        )}
      />
    </section>
  )
}
