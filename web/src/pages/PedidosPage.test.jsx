import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { manejadoresMapa } from 'react-leaflet'
import { crearPedido, editarPedido, eliminarPedido, listarPedidos, obtenerHoraServidor } from '../api/pedidosApi'
import { listarZonas } from '../api/zonasApi'
import PedidosPage from './PedidosPage'

jest.mock('../api/pedidosApi')
jest.mock('../api/zonasApi')

const ZONAS = [
  { id: 1, nombre: 'Centro', activa: true, area: { type: 'Polygon', coordinates: [] } },
  { id: 2, nombre: 'Norte', activa: false, area: { type: 'Polygon', coordinates: [] } },
]

// Respuesta simulada de GET /api/servidor/hora: 07:00 del servidor, la primera entrega de hoy es a las 07:30.
// Las fechas son fijas y distintas de las del computador de la prueba.
const HORA_SERVIDOR = {
  fecha: '2031-05-17',
  hora: '07:00:00',
  zonaHoraria: 'America/Guayaquil',
  anticipacionMinimaMinutos: 30,
  entregaMinimaFecha: '2031-05-17',
  entregaMinimaHora: '07:30:00',
}
const MENSAJE_HORA = 'La hora de entrega debe ser al menos 30 minutos después de la hora actual del servidor, 07:00'

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
    fechaEntrega: '2031-05-18', // mañana según la hora simulada del servidor
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
    fechaEntrega: '2031-05-18', // mañana según la hora simulada del servidor
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
  obtenerHoraServidor.mockResolvedValue(HORA_SERVIDOR)
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
  test('el formulario se abre en un modal y se cierra con Cancelar', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Nuevo pedido' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    expect(screen.getByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument() // el modal sigue abierto
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
      target: { value: '2031-05-15' }, // dos días antes de "hoy" según el servidor
    })
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(crearPedido).not.toHaveBeenCalled()
    expect(screen.getByText('La fecha de entrega no puede ser anterior a hoy')).toBeInTheDocument()
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

describe('PedidosPage: hora del servidor', () => {
  const fecha = () => screen.getByLabelText('Fecha de entrega', { selector: '#fechaEntrega' })
  const hora = () => screen.getByLabelText('Hora aproximada')

  test('al abrir Nuevo pedido pide la hora a /api/servidor/hora y la usa en fecha y hora mínimas', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    expect(obtenerHoraServidor).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fecha()).toHaveValue('2031-05-17')) // no la fecha del computador
    expect(fecha()).toHaveAttribute('min', '2031-05-17')
    expect(hora()).toHaveAttribute('min', '07:30')
  })

  test('al abrir Editar también la pide', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))

    expect(obtenerHoraServidor).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fecha()).toHaveAttribute('min', '2031-05-17'))
  })

  test('cada vez que se abre el formulario la vuelve a pedir', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    obtenerHoraServidor.mockResolvedValue({ ...HORA_SERVIDOR, fecha: '2031-05-18', entregaMinimaFecha: '2031-05-18' })
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    expect(obtenerHoraServidor).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(fecha()).toHaveAttribute('min', '2031-05-18'))
  })

  test('una respuesta atrasada de una apertura anterior no pisa la de la actual', async () => {
    const user = userEvent.setup()
    let responderPrimera
    obtenerHoraServidor.mockReturnValueOnce(new Promise((resolver) => (responderPrimera = resolver)))
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    obtenerHoraServidor.mockResolvedValue({ ...HORA_SERVIDOR, entregaMinimaFecha: '2031-05-20' })
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await waitFor(() => expect(fecha()).toHaveAttribute('min', '2031-05-20'))

    await act(async () => responderPrimera({ ...HORA_SERVIDOR, entregaMinimaFecha: '2031-05-17' }))

    expect(fecha()).toHaveAttribute('min', '2031-05-20')
  })

  test('hoy con una hora pasada avisa con la hora del servidor y no envía', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await waitFor(() => expect(fecha()).toHaveValue('2031-05-17'))
    await llenarNuevoPedido(user)

    fireEvent.change(hora(), { target: { value: '06:00' } })
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(screen.getByText(MENSAJE_HORA)).toBeInTheDocument()
    expect(crearPedido).not.toHaveBeenCalled()
  })

  test('hoy con una hora válida o mañana a cualquier hora se envía', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await waitFor(() => expect(fecha()).toHaveValue('2031-05-17'))
    await llenarNuevoPedido(user) // 09:15, después de las 07:30

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))
    await waitFor(() =>
      expect(crearPedido).toHaveBeenCalledWith(expect.objectContaining({ fechaEntrega: '2031-05-17', horaEntrega: '09:15' })),
    )

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await waitFor(() => expect(fecha()).toHaveValue('2031-05-17'))
    await llenarNuevoPedido(user)
    fireEvent.change(fecha(), { target: { value: '2031-05-18' } })
    fireEvent.change(hora(), { target: { value: '05:00' } })
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))
    await waitFor(() =>
      expect(crearPedido).toHaveBeenLastCalledWith(expect.objectContaining({ fechaEntrega: '2031-05-18', horaEntrega: '05:00' })),
    )
  })

  test('si el endpoint no responde el formulario abre sin mínimos y el backend valida y muestra su mensaje', async () => {
    const user = userEvent.setup()
    obtenerHoraServidor.mockRejectedValue(errorHttp(500, 'ERROR_INTERNO', 'Ocurrio un error interno'))
    crearPedido.mockRejectedValue(errorHttp(422, 'HORA_ENTREGA_INVALIDA', MENSAJE_HORA))
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)

    expect(screen.getByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument()
    expect(fecha()).not.toHaveAttribute('min')
    expect(hora()).not.toHaveAttribute('min')
    expect(screen.queryByText('Ocurrio un error interno')).not.toBeInTheDocument() // el fallo de la hora no estorba

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(crearPedido).toHaveBeenCalledTimes(1) // el formulario no bloquea: decide el backend
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_HORA)
    expect(screen.getByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument()
  })

  test('una respuesta incompleta se trata como si el endpoint no respondiera', async () => {
    const user = userEvent.setup()
    obtenerHoraServidor.mockResolvedValue({ fecha: '2031-05-17' })
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    await waitFor(() => expect(obtenerHoraServidor).toHaveBeenCalled())
    expect(fecha()).not.toHaveAttribute('min')
    expect(hora()).not.toHaveAttribute('min')
  })

  test('el backend rechaza la hora al editar: se muestra su mensaje y el formulario sigue abierto', async () => {
    const user = userEvent.setup()
    editarPedido.mockRejectedValue(errorHttp(422, 'HORA_ENTREGA_INVALIDA', MENSAJE_HORA))
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))
    await waitFor(() => expect(fecha()).toHaveAttribute('min', '2031-05-17'))

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_HORA)
    expect(screen.getByRole('dialog', { name: 'Editar pedido 1' })).toBeInTheDocument()
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editarPedido).not.toHaveBeenCalled()
  })

  test('pasar de editar a registrar vacía el formulario', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

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

describe('PedidosPage: modal del formulario', () => {
  test('Nuevo pedido abre un diálogo accesible con el foco en el primer campo', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    const dialogo = screen.getByRole('dialog', { name: 'Nuevo pedido' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Nombres del cliente')).toHaveFocus()
  })

  test('Editar abre el modal con el título y los datos del pedido', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))

    expect(screen.getByRole('dialog', { name: 'Editar pedido 1' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombres del cliente')).toHaveValue('Maria Torres')
  })

  test('Esc cierra el modal sin guardar', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(crearPedido).not.toHaveBeenCalled()
  })

  test('el foco vuelve al botón que abrió el modal', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toHaveFocus()
  })

  test('la lista sigue en la página (no se mueve) y el modal queda fuera de ella', async () => {
    const user = userEvent.setup()
    await dibujar()
    const tabla = screen.getByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    expect(screen.getByRole('table')).toBe(tabla)
    expect(screen.getByRole('dialog').closest('section')).toBeNull()
    expect(document.body.style.overflow).toBe('hidden') // la página de fondo no se desplaza

    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  test('al abrir el formulario se vuelven a pedir las zonas y el mapa muestra las nuevas', async () => {
    const user = userEvent.setup()
    await dibujar()
    const nueva = { id: 3, nombre: 'Ficoa', activa: true, area: { type: 'Polygon', coordinates: [] } }
    listarZonas.mockResolvedValue([...ZONAS, nueva])

    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))

    await waitFor(() => expect(screen.getAllByTestId('geojson')).toHaveLength(2))
    expect(screen.getByText('Ficoa', { selector: '[data-testid="tooltip"]' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ficoa' })).toBeInTheDocument() // también en el filtro de zona
  })

  test('tras crear un pedido la lista se actualiza sin recargar la página', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    await llenarNuevoPedido(user)
    listarPedidos.mockResolvedValue({
      pedidos: [...PEDIDOS, { ...PEDIDOS[0], id: 3, clienteNombres: 'Ana Ruiz' }],
      total: 3,
    })

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('3 pedido(s)')).toBeInTheDocument()
  })

  test('tras editar un pedido la lista muestra los datos nuevos', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar pedido 1' }))
    listarPedidos.mockResolvedValue({ pedidos: [{ ...PEDIDOS[0], direccion: 'Dirección nueva' }, PEDIDOS[1]], total: 2 })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Dirección nueva')).toBeInTheDocument()
    expect(screen.queryByText('Bolívar y Mera')).not.toBeInTheDocument()
  })

  test('tras eliminar un pedido desaparece de la lista', async () => {
    const user = userEvent.setup()
    await dibujar()
    listarPedidos.mockResolvedValue({ pedidos: [PEDIDOS[1]], total: 1 })

    await user.click(screen.getByRole('button', { name: 'Eliminar pedido 1' }))

    await waitFor(() => expect(screen.queryByText('Maria Torres')).not.toBeInTheDocument())
    expect(screen.getByText('1 pedido(s)')).toBeInTheDocument()
  })
})
