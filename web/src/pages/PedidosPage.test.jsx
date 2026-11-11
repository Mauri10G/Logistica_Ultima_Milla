import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { manejadoresMapa } from 'react-leaflet'
import { crearPedido, editarPedido, eliminarPedido, listarPedidos } from '../api/pedidosApi'
import { listarZonas } from '../api/zonasApi'
import { fechaIso } from '../hooks/fechas'
import PedidosPage from './PedidosPage'

jest.mock('../api/pedidosApi')
jest.mock('../api/zonasApi')

const ZONAS = [
  { id: 1, nombre: 'Centro', activa: true, area: { type: 'Polygon', coordinates: [] } },
  { id: 2, nombre: 'Norte', activa: false, area: { type: 'Polygon', coordinates: [] } },
]

const PEDIDOS = [
  {
    id: 1,
    clienteId: 10,
    clienteNombres: 'Maria Torres',
    clienteTelefono: '0982000001',
    direccion: 'Bolívar y Mera',
    latitud: -1.24,
    longitud: -78.62,
    zonaNombre: 'Centro',
    fechaEntrega: fechaIso(1),
    horaEntrega: '10:00:00',
    fechaRegistro: '2026-03-01T08:15:30',
    estado: 'PENDIENTE',
    prioridad: 'NORMAL',
  },
  {
    id: 2,
    clienteId: 11,
    clienteNombres: 'Luis Mora',
    clienteTelefono: '0991112223',
    direccion: 'Cevallos y Sucre',
    latitud: -1.25,
    longitud: -78.61,
    zonaNombre: 'Centro',
    fechaEntrega: fechaIso(1),
    horaEntrega: '11:30:00',
    fechaRegistro: '2026-03-01T09:00:00',
    estado: 'ASIGNADO',
    prioridad: 'ALTA',
  },
]

function errorHttp(status, codigo, mensaje) {
  return { response: { status, data: { codigo, mensaje } } }
}

async function dibujar() {
  render(<PedidosPage />)
  await screen.findByText('Maria Torres')
}

async function llenarNuevoPedido(user) {
  await user.type(screen.getByLabelText('Nombres del cliente'), 'Ana Ruiz')
  await user.type(screen.getByLabelText('Teléfono'), '0970000000')
  await user.type(screen.getByLabelText('Dirección de entrega'), 'Montalvo y Bolívar')
  await user.type(screen.getByLabelText('Hora aproximada'), '09:15')
  act(() => manejadoresMapa.actual.click({ latlng: { lat: -1.2412, lng: -78.6197 } }))
}

beforeEach(() => {
  jest.resetAllMocks()
  listarPedidos.mockResolvedValue({ pedidos: PEDIDOS, total: 2 })
  listarZonas.mockResolvedValue(ZONAS)
  crearPedido.mockResolvedValue({ id: 3 })
  editarPedido.mockResolvedValue({ id: 1 })
  eliminarPedido.mockResolvedValue(undefined)
  jest.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('PedidosPage: lista y filtros', () => {
  test('muestra los pedidos con su zona, entrega, registro y estado', async () => {
    await dibujar()

    expect(screen.getByText('Cevallos y Sucre')).toBeInTheDocument()
    expect(screen.getByText('2026-03-01 08:15')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Asignado')).toBeInTheDocument()
    expect(screen.getByText('2 pedido(s)')).toBeInTheDocument()
  })

  test('solo los pedidos PENDIENTE se pueden editar o eliminar', async () => {
    await dibujar()

    expect(screen.getByRole('button', { name: 'Editar pedido 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar pedido 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar pedido 2' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar pedido 2' })).not.toBeInTheDocument()
  })

  test('avisa cuántos se muestran si hay más que la página', async () => {
    listarPedidos.mockResolvedValue({ pedidos: PEDIDOS, total: 350 })
    await dibujar()

    expect(screen.getByText('350 pedido(s) (mostrando 2)')).toBeInTheDocument()
  })

  test('sin resultados lo dice', async () => {
    listarPedidos.mockResolvedValue({ pedidos: [], total: 0 })
    render(<PedidosPage />)

    expect(await screen.findByText('No hay pedidos con esos filtros.')).toBeInTheDocument()
  })

  test('filtra por estado, zona y fecha con los parámetros del backend', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.selectOptions(screen.getByLabelText('Estado'), 'PENDIENTE')
    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'PENDIENTE' })))

    await user.selectOptions(screen.getByLabelText('Zona'), '1')
    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ zonaId: '1' })))

    fireEvent.change(screen.getByLabelText('Fecha de entrega'), { target: { value: '2026-03-05' } })
    await waitFor(() =>
      expect(listarPedidos).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: 'PENDIENTE', zonaId: '1', fecha: '2026-03-05' }),
      ),
    )
  })

  test('el filtro de zona lista todas las zonas', async () => {
    await dibujar()

    expect(screen.getByRole('option', { name: 'Centro' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Norte' })).toBeInTheDocument()
  })

  test('muestra el error si falla la carga', async () => {
    listarPedidos.mockRejectedValue(errorHttp(500, 'ERROR_INTERNO', 'Ocurrio un error interno'))
    render(<PedidosPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('muestra el error si falla la carga de zonas', async () => {
    listarZonas.mockRejectedValue(errorHttp(500, 'ERROR_INTERNO', 'No se pudieron cargar las zonas'))
    render(<PedidosPage />)

    expect(await screen.findByText('No se pudieron cargar las zonas')).toBeInTheDocument()
  })
})

describe('PedidosPage: registrar', () => {
  test('el formulario se abre y se cierra', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    expect(screen.getByRole('form', { name: 'Nuevo pedido' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    expect(screen.queryByRole('form', { name: 'Nuevo pedido' })).not.toBeInTheDocument()
  })

  test('el mapa del formulario muestra solo las zonas activas', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    expect(screen.getAllByTestId('geojson')).toHaveLength(1)
  })

  test('registra el pedido, cierra el formulario y recarga la lista', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)
    const cargasAntes = listarPedidos.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    await waitFor(() =>
      expect(crearPedido).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteNombres: 'Ana Ruiz',
          direccion: 'Montalvo y Bolívar',
          latitud: -1.2412,
          longitud: -78.6197,
          horaEntrega: '09:15',
        }),
      ),
    )
    expect(await screen.findByText('Pedido registrado.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Nuevo pedido' })).not.toBeInTheDocument()
    expect(listarPedidos.mock.calls.length).toBeGreaterThan(cargasAntes)
  })

  test('CP-03: una dirección fuera de zona se explica y el formulario queda abierto', async () => {
    const user = userEvent.setup()
    crearPedido.mockRejectedValue(
      errorHttp(422, 'DIRECCION_FUERA_DE_ZONA', 'La dirección no corresponde a ninguna zona configurada'),
    )
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no corresponde a ninguna zona configurada')
    expect(screen.getByRole('form', { name: 'Nuevo pedido' })).toBeInTheDocument()
  })

  test('CP-04: si el backend rechaza la fecha pasada lo explica', async () => {
    const user = userEvent.setup()
    crearPedido.mockRejectedValue(
      errorHttp(422, 'FECHA_ENTREGA_PASADA', 'La fecha de entrega no puede ser anterior a hoy'),
    )
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha de entrega no puede ser anterior a hoy')
  })

  test('CP-04: el formulario ni siquiera envía una fecha anterior a hoy', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)

    fireEvent.change(screen.getByLabelText('Fecha de entrega', { selector: '#fechaEntrega' }), {
      target: { value: fechaIso(-2) },
    })
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(crearPedido).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser anterior a hoy')
  })

  test('un error de validación del backend muestra el detalle de los campos', async () => {
    const user = userEvent.setup()
    crearPedido.mockRejectedValue({
      response: { status: 400, data: { mensaje: 'Hay campos invalidos', errores: { clienteTelefono: 'muy largo' } } },
    })
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('clienteTelefono: muy largo')
  })
})

describe('PedidosPage: editar y eliminar', () => {
  test('editar abre el formulario con los datos del pedido y guarda los cambios', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))
    expect(screen.getByRole('heading', { name: 'Editar pedido 1' })).toBeInTheDocument()
    expect(screen.getByLabelText('Dirección de entrega')).toHaveValue('Bolívar y Mera')

    await user.clear(screen.getByLabelText('Dirección de entrega'))
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Nueva dirección')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(editarPedido).toHaveBeenCalledWith(1, expect.objectContaining({ clienteId: 10, direccion: 'Nueva dirección' })),
    )
    expect(await screen.findByText('Pedido 1 actualizado.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Editar pedido' })).not.toBeInTheDocument()
  })

  test('CP-05: si el pedido ya no es PENDIENTE (409) lo explica y recarga la lista', async () => {
    const user = userEvent.setup()
    editarPedido.mockRejectedValue(errorHttp(409, 'PEDIDO_NO_EDITABLE', 'Solo se editan pedidos PENDIENTE'))
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))
    const cargasAntes = listarPedidos.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya no se puede modificar')
    expect(listarPedidos.mock.calls.length).toBeGreaterThan(cargasAntes)
  })

  test('cancelar la edición cierra el formulario', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('form', { name: 'Editar pedido' })).not.toBeInTheDocument()
    expect(editarPedido).not.toHaveBeenCalled()
  })

  test('pasar de editar a registrar vacía el formulario', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar formulario' }))

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    expect(screen.getByLabelText('Nombres del cliente')).toHaveValue('')
  })

  test('eliminar pide confirmación, borra y recarga', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Eliminar pedido 1' }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(eliminarPedido).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Pedido 1 eliminado.')).toBeInTheDocument()
  })

  test('si no se confirma no se elimina', async () => {
    const user = userEvent.setup()
    window.confirm.mockReturnValue(false)
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Eliminar pedido 1' }))

    expect(eliminarPedido).not.toHaveBeenCalled()
  })

  test('si el pedido ya no es PENDIENTE (409) lo explica', async () => {
    const user = userEvent.setup()
    eliminarPedido.mockRejectedValue(errorHttp(409, 'PEDIDO_NO_EDITABLE', 'Solo se eliminan pedidos PENDIENTE'))
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Eliminar pedido 1' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya no se puede modificar')
  })
})
