import { MapPinned, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { listarPedidos } from '../api/pedidosApi'
import { actualizarZona, crearZona, listarZonas } from '../api/zonasApi'
import { codigoDeError, estadoHttp, mensajeDeError } from '../utils/errores'
import { zonasSuperpuestas } from '../utils/zonas'
import Avisos from '../components/Avisos'
import { colorDeZona } from '../components/constantesMapa'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoVacio from '../components/EstadoVacio'
import Interruptor from '../components/Interruptor'
import Tabla from '../components/Tabla'
import ZonaForm from '../components/ZonaForm'
import { useConfirmacion } from '../hooks/useConfirmacion'

const COLUMNAS = [
  { clave: 'id', titulo: '#' },
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'activa', titulo: 'Activa' },
  { clave: 'acciones', titulo: 'Acciones' },
]

const VALORES = {
  id: (zona) => zona.id,
  nombre: (zona) => zona.nombre,
  activa: (zona) => (zona.activa ? 0 : 1), // al ordenar ascendente, las activas primero
}

// Al cargar o recargar, la tabla viene por número de zona de menor a mayor.
const ORDEN_INICIAL = { clave: 'id', direccion: 'asc' }

export default function ZonasPage() {
  const [zonas, setZonas] = useState([])
  const [zonaEnEdicion, setZonaEnEdicion] = useState(null)
  const [errorLista, setErrorLista] = useState(null)
  const [errorForm, setErrorForm] = useState(null)
  const [advertencia, setAdvertencia] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mostrarInactivas, setMostrarInactivas] = useState(false)
  const [version, setVersion] = useState(0) // cambia tras guardar para vaciar el formulario
  const [cargando, setCargando] = useState(true)
  const { pedir, dialogo } = useConfirmacion()

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
        const desactivada = zonaEnEdicion.activa && datos.activa === false
        setMensaje(`Zona "${datos.nombre}" ${desactivada ? 'desactivada' : 'actualizada'}.`)
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

  /** Pedidos PENDIENTE de la zona (de cualquier fecha); null si no se pudo consultar. */
  async function contarPendientes(zona) {
    try {
      return (await listarPedidos({ zonaId: zona.id, estado: 'PENDIENTE', size: 1 })).total
    } catch {
      return null
    }
  }

  function textoPendientes(pendientes) {
    if (pendientes === null) return 'No se pudo consultar cuántos pedidos pendientes tiene la zona.'
    if (pendientes === 0) return 'La zona no tiene pedidos pendientes.'
    return `La zona tiene ${pendientes} pedido(s) pendiente(s): revíselos, porque quedarán en una zona inactiva.`
  }

  /** Confirma desactivar una zona activa, con cuántos pedidos pendientes tiene (al desmarcar y al guardar). */
  async function confirmarDesactivar(zona, momento) {
    const pendientes = await contarPendientes(zona)
    const alGuardar = momento === 'guardar'
    return pedir({
      titulo: alGuardar ? `¿Guardar y desactivar la zona ${zona.nombre}?` : `¿Desactivar la zona ${zona.nombre}?`,
      descripcion: `Una zona inactiva no se dibuja en el mapa ni se ofrece al registrar pedidos. ${textoPendientes(pendientes)}`,
      detalles: [
        ['Zona', zona.nombre],
        ['Pedidos pendientes', pendientes === null ? 'No disponible' : String(pendientes)],
      ],
      textoConfirmar: alGuardar ? 'Guardar y desactivar' : 'Desactivar zona',
      variante: 'advertencia',
    })
  }

  /** Confirma "Guardar de todas formas" nombrando las zonas con las que se cruza la nueva. */
  function confirmarSuperposicion(mensajeAdvertencia) {
    const nombres = zonasSuperpuestas(mensajeAdvertencia)
    return pedir({
      titulo: '¿Guardar la zona aunque se superponga?',
      descripcion:
        nombres.length > 0
          ? 'Dos zonas no deberían ocupar la misma superficie: un pedido ubicado en el cruce se asignará a una sola de ellas.'
          : mensajeAdvertencia,
      detalles: nombres.length > 0 ? [[nombres.length === 1 ? 'Se cruza con la zona' : 'Se cruza con las zonas', nombres.join(', ')]] : [],
      textoConfirmar: 'Guardar de todas formas',
      variante: 'advertencia',
    })
  }

  const zonasVisibles = zonas.filter((zona) => mostrarInactivas || zona.activa)
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

      {dialogo}
      <Avisos
        mensaje={mensaje}
        error={errorLista}
        onCerrarMensaje={() => setMensaje(null)}
        onCerrarError={() => setErrorLista(null)}
      />

      <div className="dos-columnas">
        <div>
          <div className="filtros">
            <Interruptor etiqueta="Mostrar inactivas" activo={mostrarInactivas} onCambiar={setMostrarInactivas} />
          </div>
          <Tabla
            titulo="Zonas de reparto"
            columnas={COLUMNAS}
            valores={VALORES}
            filas={zonasVisibles}
            cargando={cargando}
            ordenInicial={ORDEN_INICIAL}
            reiniciarCon={[mostrarInactivas]}
            vacio={
              <EstadoVacio
                icono={MapPinned}
                titulo="No hay zonas configuradas."
                ayuda={
                  zonas.length > 0
                    ? 'Solo hay zonas inactivas: active «Mostrar inactivas» para verlas.'
                    : 'Dibuje la primera zona en el mapa del formulario.'
                }
              />
            }
            renderFila={(zona) => (
              <tr key={zona.id}>
                <td>{zona.id}</td>
                <td>
                  <span className="zona-nombre">
                    <span
                      className={zona.activa ? 'zona-color' : 'zona-color zona-color-inactiva'}
                      style={zona.activa ? { background: colorDeZona(zona) } : undefined}
                      title={zona.activa ? 'Color de la zona en el mapa' : 'Zona inactiva: no se dibuja en el mapa'}
                      data-testid={`zona-color-${zona.id}`}
                      aria-hidden="true"
                    />
                    {zona.nombre}
                  </span>
                </td>
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
            )}
          />
        </div>

        <div className="tarjeta">
          <ZonaForm
            key={`${zonaEnEdicion?.id ?? 'nueva'}-${version}`}
            zona={zonaEnEdicion}
            zonasReferencia={zonasReferencia}
            onGuardar={guardar}
            onCancelar={zonaEnEdicion ? terminarEdicion : undefined}
            onEditar={limpiarAvisos}
            onConfirmarDesactivar={confirmarDesactivar}
            onConfirmarSuperposicion={confirmarSuperposicion}
            guardando={guardando}
            error={errorForm}
            advertencia={advertencia}
          />
        </div>
      </div>
    </section>
  )
}
