import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cambiarDisponibilidad, crearRepartidor, listarRepartidores } from '../api/repartidoresApi'
import RepartidoresPage from './RepartidoresPage'

jest.mock('../api/repartidoresApi')

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
})

describe('RepartidoresPage', () => {
  test('lista los repartidores con su disponibilidad', async () => {
    await dibujar()

    expect(screen.getByText('0982222222')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disponible · marcar no disponible' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No disponible · marcar disponible' })).toBeInTheDocument()
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

  test('CP-10: registra un repartidor y limpia el formulario', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.type(screen.getByLabelText('Nombres'), 'Carlos Vera')
    await user.type(screen.getByLabelText('Teléfono', { selector: '#repTelefono' }), '0983333333')
    await user.click(screen.getByRole('button', { name: 'Agregar repartidor' }))

    await waitFor(() => expect(crearRepartidor).toHaveBeenCalledWith({ nombres: 'Carlos Vera', telefono: '0983333333' }))
    await waitFor(() => expect(screen.getByLabelText('Nombres')).toHaveValue(''))
    expect(listarRepartidores).toHaveBeenCalledTimes(2)
  })

  test('no envía el formulario si faltan datos', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Agregar repartidor' }))

    expect(crearRepartidor).not.toHaveBeenCalled()
  })

  test('muestra el error al registrar', async () => {
    const user = userEvent.setup()
    crearRepartidor.mockRejectedValue({
      response: { status: 400, data: { mensaje: 'Hay campos invalidos', errores: { telefono: 'muy largo' } } },
    })
    await dibujar()

    await user.type(screen.getByLabelText('Nombres'), 'Carlos Vera')
    await user.type(screen.getByLabelText('Teléfono', { selector: '#repTelefono' }), '1')
    await user.click(screen.getByRole('button', { name: 'Agregar repartidor' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('telefono: muy largo')
  })

  test('CP-10: cambia la disponibilidad', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Disponible · marcar no disponible' }))

    await waitFor(() => expect(cambiarDisponibilidad).toHaveBeenCalledWith(1, false))
    await waitFor(() => expect(listarRepartidores).toHaveBeenCalledTimes(2))
  })

  test('muestra el error al cambiar la disponibilidad', async () => {
    const user = userEvent.setup()
    cambiarDisponibilidad.mockRejectedValue({ response: { status: 404, data: { mensaje: 'No existe el repartidor con id 2' } } })
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'No disponible · marcar disponible' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe el repartidor con id 2')
  })
})
