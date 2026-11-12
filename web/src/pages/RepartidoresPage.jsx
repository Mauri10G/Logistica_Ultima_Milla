import { Plus, Truck, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cambiarDisponibilidad, crearRepartidor, listarRepartidores } from '../api/repartidoresApi'
import Avisos from '../components/Avisos'
import { listarRutas } from '../api/rutasApi'
import Buscador from '../components/Buscador'
import EncabezadoPagina from '../components/EncabezadoPagina'
import EstadoVacio from '../components/EstadoVacio'
import Interruptor from '../components/Interruptor'
import Modal from '../components/Modal'
import Tabla from '../components/Tabla'
import { fechaIso } from '../hooks/fechas'
import { useConfirmacion } from '../hooks/useConfirmacion'
import { coincide } from '../utils/busqueda'
import { mensajeDeError } from '../utils/errores'

const COLUMNAS = [
  { clave: 'id', titulo: '#' },
  { clave: 'nombres', titulo: 'Nombres' },
  { clave: 'telefono', titulo: 'Teléfono' },
  { clave: 'capacidad', titulo: 'Capacidad' },
  { clave: 'ruta', titulo: 'Ruta de hoy' },
  { clave: 'disponible', titulo: 'Disponible' },
]

// Al cargar o recargar, la tabla viene por número de repartidor de menor a mayor.
const ORDEN_INICIAL = { clave: 'id', direccion: 'asc' }

/** Ruta de hoy de cada repartidor, tomada de GET /api/rutas?fecha=hoy: { [repartidorId]: ruta }. */
function rutasPorRepartidor(rutas) {
  const porRepartidor = {}
  for (const ruta of rutas) {
    if (!porRepartidor[ruta.repartidorId]) porRepartidor[ruta.repartidorId] = ruta
  }
  return porRepartidor
}

function textoRuta(ruta) {
  return `Ruta ${ruta.id} · ${ruta.zonaNombre} · ${ruta.pedidos?.length ?? 0}/${ruta.maxPedidos} pedidos`
}

export default function RepartidoresPage() {
  const [repartidores, setRepartidores] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [rutasHoy, setRutasHoy] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [nombres, setNombres] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState(null)
  const [errorForm, setErrorForm] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const { pedir, dialogo } = useConfirmacion()

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

  // La ruta de hoy es informativa: si no se puede consultar, la columna queda en "—" y no se muestra otro error.
  const cargarRutasHoy = useCallback(async () => {
    try {
      setRutasHoy(rutasPorRepartidor(await listarRutas(fechaIso(0))))
    } catch {
      setRutasHoy({})
    }
  }, [])

  useEffect(() => {
    cargar()
    cargarRutasHoy()
  }, [cargar, cargarRutasHoy])

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

  /** Cerrar el formulario (Cancelar o Esc): si hay datos escritos sin guardar, primero se pregunta. */
  function pedirCierreForm() {
    if (enviando) return
    if (!nombres.trim() && !telefono.trim()) {
      cerrarForm()
      return
    }
    pedir({
      titulo: '¿Descartar los cambios?',
      descripcion: 'Escribió datos del repartidor que todavía no guardó. Si cierra ahora, se perderán.',
      textoConfirmar: 'Descartar cambios',
      textoCancelar: 'Seguir editando',
      onConfirmar: cerrarForm,
    })
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

  async function aplicarDisponibilidad(repartidor, disponible) {
    setMensaje(null)
    try {
      await cambiarDisponibilidad(repartidor.id, disponible)
      setMensaje(`${repartidor.nombres} ahora ${disponible ? 'está disponible' : 'no está disponible'}.`)
      await cargar()
    } catch (e) {
      setError(`No se pudo cambiar la disponibilidad de ${repartidor.nombres}. ${mensajeDeError(e)}`)
    }
  }

  /** Marcar como no disponible a quien tiene ruta hoy pide confirmación, nombrando la ruta; lo demás se aplica directo. */
  async function alternar(repartidor) {
    const disponible = !repartidor.disponible
    const ruta = rutasHoy?.[repartidor.id]
    if (!disponible && ruta) {
      const confirmado = await pedir({
        titulo: `¿Marcar a ${repartidor.nombres} como no disponible?`,
        descripcion:
          'Tiene una ruta asignada para hoy. Si deja de estar disponible dejará de recibir rutas nuevas; revise si hace falta reasignar la que ya tiene.',
        detalles: [
          ['Repartidor', repartidor.nombres],
          ['Ruta de hoy', textoRuta(ruta)],
        ],
        textoConfirmar: 'Marcar no disponible',
        variante: 'advertencia',
      })
      if (!confirmado) return
    }
    await aplicarDisponibilidad(repartidor, disponible)
  }

  const visibles = repartidores.filter((repartidor) => coincide(busqueda, repartidor.nombres, repartidor.telefono))
  const valores = useMemo(
    () => ({
      id: (repartidor) => repartidor.id,
      nombres: (repartidor) => repartidor.nombres,
      telefono: (repartidor) => repartidor.telefono,
      capacidad: (repartidor) => repartidor.capacidadMaxima,
      ruta: (repartidor) => rutasHoy?.[repartidor.id]?.id ?? null,
      disponible: (repartidor) => (repartidor.disponible ? 0 : 1), // ascendente: primero los disponibles
    }),
    [rutasHoy],
  )

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

      {dialogo}
      <Avisos
        mensaje={mensaje}
        error={error}
        onCerrarMensaje={() => setMensaje(null)}
        onCerrarError={() => setError(null)}
      />
      <div className="filtros">
        <Buscador
          id="buscarRepartidor"
          etiqueta="Buscar repartidor"
          valor={busqueda}
          onCambiar={setBusqueda}
          placeholder="Nombre o teléfono"
        />
      </div>
      <Tabla
        titulo="Repartidores"
        columnas={COLUMNAS}
        valores={valores}
        filas={visibles}
        cargando={cargando}
        ordenInicial={ORDEN_INICIAL}
        reiniciarCon={[busqueda]}
        vacio={
          <EstadoVacio
            icono={Truck}
            titulo="No hay repartidores registrados."
            ayuda="Agregue un repartidor para poder asignarle rutas."
          />
        }
        renderFila={(repartidor) => {
          const ruta = rutasHoy?.[repartidor.id]
          return (
            <tr key={repartidor.id}>
              <td>{repartidor.id}</td>
              <td>{repartidor.nombres}</td>
              <td>{repartidor.telefono}</td>
              <td>{repartidor.capacidadMaxima}</td>
              <td>{ruta ? textoRuta(ruta) : '—'}</td>
              <td>
                <Interruptor
                  etiqueta="Disponible"
                  descripcion={`de ${repartidor.nombres}`}
                  activo={Boolean(repartidor.disponible)}
                  onCambiar={() => alternar(repartidor)}
                />
              </td>
            </tr>
          )
        }}
      />

      {mostrarForm && (
        <Modal titulo="Nuevo repartidor" onCerrar={pedirCierreForm}>
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
              <button type="button" className="secundario" onClick={pedirCierreForm}>
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
