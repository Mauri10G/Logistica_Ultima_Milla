import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cambiarDisponibilidad, crearRepartidor, listarRepartidores } from '../api/repartidoresApi'
import { listarRutas } from '../api/rutasApi'
import { fechaIso } from '../hooks/fechas'
import RepartidoresPage from './RepartidoresPage'

jest.mock('../api/repartidoresApi')
jest.mock('../api/rutasApi')

const REPARTIDORES = [
  { id: 1, nombres: 'Ana Pérez', telefono: '0981111111', capacidadMaxima: 4, disponible: true },
  { id: 2, nombres: 'Luis Mora', telefono: '0982222222', capacidadMaxima: 4, disponible: false },
]

async function dibujar() {
  render(<RepartidoresPage />)
  await screen.findByText('Ana Pérez')
}

beforeEach(() => {
  jest.resetAllMocks()
  listarRepartidores.mockResolvedValue(REPARTIDORES)
  crearRepartidor.mockResolvedValue({ id: 3 })
  cambiarDisponibilidad.mockResolvedValue({})
  listarRutas.mockResolvedValue([])
})

describe('RepartidoresPage', () => {
  test('lista los repartidores con su disponibilidad', async () => {
    await dibujar()

    expect(screen.getByText('0982222222')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Disponible de Ana Pérez' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Disponible de Luis Mora' })).not.toBeChecked()
  })

  test('la disponibilidad es un interruptor con la etiqueta visible Disponible', async () => {
    await dibujar()

    const interruptores = screen.getAllByRole('switch')
    expect(interruptores).toHaveLength(2)
    expect(screen.getAllByText('Disponible', { selector: '.interruptor-texto' })).toHaveLength(2)
    expect(screen.queryByText(/marcar no disponible|marcar disponible/)).not.toBeInTheDocument()
  })

  test('sin repartidores lo dice', async () => {
    listarRepartidores.mockResolvedValue([])
    render(<RepartidoresPage />)

    expect(await screen.findByText('No hay repartidores registrados.')).toBeInTheDocument()
  })

  test('muestra el error si falla la carga', async () => {
    listarRepartidores.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Ocurrio un error interno' } } })
    render(<RepartidoresPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('el formulario no se ve hasta pulsar Nuevo repartidor', async () => {
    await dibujar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('Nuevo repartidor abre un modal accesible con el foco en el primer campo', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))

    expect(screen.getByRole('dialog', { name: 'Nuevo repartidor' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Nombres')).toHaveFocus()
  })

  test('Cancelar y Esc cierran el modal sin guardar', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(crearRepartidor).not.toHaveBeenCalled()
  })

  test('CP-10: registra un repartidor, cierra el modal y actualiza la lista', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))
    listarRepartidores.mockResolvedValue([
      ...REPARTIDORES,
      { id: 3, nombres: 'Carlos Vera', telefono: '0983333333', capacidadMaxima: 4, disponible: true },
    ])

    await user.type(screen.getByLabelText('Nombres'), 'Carlos Vera')
    await user.type(screen.getByLabelText('Teléfono', { selector: '#repTelefono' }), '0983333333')
    await user.click(screen.getByRole('button', { name: 'Agregar repartidor' }))

    await waitFor(() => expect(crearRepartidor).toHaveBeenCalledWith({ nombres: 'Carlos Vera', telefono: '0983333333' }))
    expect(await screen.findByText('Repartidor Carlos Vera agregado.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('0983333333')).toBeInTheDocument()
  })

  test('al volver a abrir el modal el formulario está vacío', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))
    await user.type(screen.getByLabelText('Nombres'), 'Medio escrito')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))

    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))

    expect(screen.getByLabelText('Nombres')).toHaveValue('')
  })

  test('no envía el formulario si faltan datos', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))

    await user.click(screen.getByRole('button', { name: 'Agregar repartidor' }))

    expect(crearRepartidor).not.toHaveBeenCalled()
  })

  test('muestra el error dentro del modal y lo deja abierto', async () => {
    const user = userEvent.setup()
    crearRepartidor.mockRejectedValue({
      response: { status: 400, data: { mensaje: 'Hay campos invalidos', errores: { telefono: 'muy largo' } } },
    })
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))

    await user.type(screen.getByLabelText('Nombres'), 'Carlos Vera')
    await user.type(screen.getByLabelText('Teléfono', { selector: '#repTelefono' }), '1')
    await user.click(screen.getByRole('button', { name: 'Agregar repartidor' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('telefono: muy largo')
    expect(screen.getByRole('dialog', { name: 'Nuevo repartidor' })).toBeInTheDocument()
  })

  test('CP-10: cambia la disponibilidad', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('switch', { name: 'Disponible de Ana Pérez' }))

    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(1, false))
    await waitFor(() => expect(listarRepartidores).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Ana Pérez ahora no está disponible.')).toBeInTheDocument()
  })

  test('volver a poner disponible a un repartidor avisa con su nombre', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('switch', { name: 'Disponible de Luis Mora' }))

    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(2, true))
    expect(await screen.findByText('Luis Mora ahora está disponible.')).toBeInTheDocument()
  })

  test('muestra el error al cambiar la disponibilidad', async () => {
    const user = userEvent.setup()
    cambiarDisponibilidad.mockRejectedValue({ response: { status: 404, data: { mensaje: 'No existe el repartidor con id 2' } } })
    await dibujar()

    await user.click(screen.getByRole('switch', { name: 'Disponible de Luis Mora' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cambiar la disponibilidad de Luis Mora. No existe el repartidor con id 2',
    )
  })
})

describe('RepartidoresPage: confirmaciones', () => {
  const RUTA_HOY = { id: 7, repartidorId: 1, zonaNombre: 'Centro', maxPedidos: 4, pedidos: [{ id: 1 }, { id: 2 }] }

  async function dibujarConRuta() {
    listarRutas.mockResolvedValue([RUTA_HOY])
    await dibujar()
    await screen.findByText('Ruta 7 · Centro · 2/4 pedidos')
  }

  test('marcar no disponible a quien tiene ruta hoy pide confirmar y nombra la ruta', async () => {
    const user = userEvent.setup()
    await dibujarConRuta()

    await user.click(screen.getByRole('switch', { name: 'Disponible de Ana Pérez' }))

    const dialogo = await screen.findByRole('alertdialog', { name: '¿Marcar a Ana Pérez como no disponible?' })
    expect(within(dialogo).getByText('Ruta 7 · Centro · 2/4 pedidos', { selector: 'dd' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Marcar no disponible' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(cambiarDisponibilidad).not.toHaveBeenCalled()

    await user.click(within(dialogo).getByRole('button', { name: 'Marcar no disponible' }))

    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(1, false))
    expect(await screen.findByText('Ana Pérez ahora no está disponible.')).toBeInTheDocument()
  })

  test('cancelar deja al repartidor disponible y no llama a la API', async () => {
    const user = userEvent.setup()
    await dibujarConRuta()
    await user.click(screen.getByRole('switch', { name: 'Disponible de Ana Pérez' }))

    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Disponible de Ana Pérez' })).toBeChecked()
    expect(cambiarDisponibilidad).not.toHaveBeenCalled()
  })

  test('sin ruta hoy no pide confirmación', async () => {
    const user = userEvent.setup()
    await dibujarConRuta()

    await user.click(screen.getByRole('switch', { name: 'Disponible de Luis Mora' })) // no disponible -> disponible

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(2, true))
  })

  test('un repartidor disponible sin ruta hoy se apaga sin confirmar', async () => {
    const user = userEvent.setup()
    listarRutas.mockResolvedValue([{ ...RUTA_HOY, repartidorId: 2 }])
    await dibujar()
    await screen.findByText('Ruta 7 · Centro · 2/4 pedidos')

    await user.click(screen.getByRole('switch', { name: 'Disponible de Ana Pérez' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(1, false))
  })

  test('poner disponible a quien tiene ruta hoy no pide confirmación', async () => {
    const user = userEvent.setup()
    listarRutas.mockResolvedValue([{ ...RUTA_HOY, repartidorId: 2 }])
    await dibujar()
    await screen.findByText('Ruta 7 · Centro · 2/4 pedidos')

    await user.click(screen.getByRole('switch', { name: 'Disponible de Luis Mora' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(2, true))
  })

  test('cerrar el modal con datos escritos pregunta "¿Descartar los cambios?"', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))
    await user.type(screen.getByLabelText('Nombres'), 'Carlos')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    const pregunta = screen.getByRole('alertdialog', { name: '¿Descartar los cambios?' })
    expect(within(pregunta).getByRole('button', { name: 'Descartar cambios' })).toHaveClass('peligro')
    await user.click(within(pregunta).getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo repartidor' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombres')).toHaveValue('Carlos')

    await user.keyboard('{Escape}') // pregunta de nuevo
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(crearRepartidor).not.toHaveBeenCalled()
  })

  test('cerrar el modal vacío no pregunta', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo repartidor' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

function nombresEnTabla() {
  return screen
    .getAllByRole('row')
    .slice(1) // la primera fila es el encabezado
    .map((fila) => within(fila).getAllByRole('cell')[1].textContent)
}

describe('RepartidoresPage: orden, búsqueda y ruta de hoy', () => {
  const MAS = [
    { id: 3, nombres: 'Zoila Vera', telefono: '0983333333', capacidadMaxima: 4, disponible: true },
    { id: 4, nombres: 'Beatriz Álvarez', telefono: '0984444444', capacidadMaxima: 6, disponible: true },
  ]

  test('vienen ordenados por # de menor a mayor, con la flecha en #', async () => {
    listarRepartidores.mockResolvedValue([MAS[0], MAS[1], REPARTIDORES[1], REPARTIDORES[0]])
    await dibujar()

    expect(nombresEnTabla()).toEqual(['Ana Pérez', 'Luis Mora', 'Zoila Vera', 'Beatriz Álvarez'])
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: 'Nombres' })).not.toHaveAttribute('aria-sort')
  })

  test('el encabezado Nombres ordena por nombre y otro clic invierte', async () => {
    const user = userEvent.setup()
    listarRepartidores.mockResolvedValue([...REPARTIDORES, ...MAS])
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nombres' }))
    expect(nombresEnTabla()).toEqual(['Ana Pérez', 'Beatriz Álvarez', 'Luis Mora', 'Zoila Vera'])

    await user.click(screen.getByRole('button', { name: 'Nombres' }))
    expect(nombresEnTabla()).toEqual(['Zoila Vera', 'Luis Mora', 'Beatriz Álvarez', 'Ana Pérez'])
  })

  test('al volver a cargar la pantalla el orden vuelve a #', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<RepartidoresPage />)
    await screen.findByText('Ana Pérez')
    await user.click(screen.getByRole('button', { name: 'Nombres' }))
    await user.click(screen.getByRole('button', { name: 'Nombres' }))
    expect(nombresEnTabla()).toEqual(['Luis Mora', 'Ana Pérez'])

    unmount()
    render(<RepartidoresPage />)
    await screen.findByText('Ana Pérez')

    expect(nombresEnTabla()).toEqual(['Ana Pérez', 'Luis Mora'])
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending')
  })

  test('el buscador filtra por nombre (sin importar acentos) o teléfono', async () => {
    const user = userEvent.setup()
    listarRepartidores.mockResolvedValue([...REPARTIDORES, ...MAS])
    await dibujar()

    await user.type(screen.getByLabelText('Buscar repartidor'), 'alvarez')
    expect(nombresEnTabla()).toEqual(['Beatriz Álvarez'])

    await user.clear(screen.getByLabelText('Buscar repartidor'))
    await user.type(screen.getByLabelText('Buscar repartidor'), '0982222')
    expect(nombresEnTabla()).toEqual(['Luis Mora'])
  })

  test('una búsqueda sin resultados muestra el mensaje de vacío', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.type(screen.getByLabelText('Buscar repartidor'), 'nadie')

    expect(screen.getByText('No hay repartidores registrados.')).toBeInTheDocument()
  })

  test('la columna Ruta de hoy usa las rutas de hoy y muestra — si no tiene', async () => {
    listarRutas.mockResolvedValue([
      { id: 7, repartidorId: 1, zonaNombre: 'Centro', maxPedidos: 4, pedidos: [{ id: 1 }, { id: 2 }] },
    ])
    await dibujar()

    expect(listarRutas).toHaveBeenCalledWith(fechaIso(0))
    expect(await screen.findByText('Ruta 7 · Centro · 2/4 pedidos')).toBeInTheDocument()
    const filaLuis = screen.getByText('Luis Mora').closest('tr')
    expect(within(filaLuis).getByText('—')).toBeInTheDocument()
  })

  test('si no se pueden consultar las rutas la lista igual se muestra', async () => {
    listarRutas.mockRejectedValue({ response: { status: 500, data: { mensaje: 'Falló' } } })
    await dibujar()

    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
