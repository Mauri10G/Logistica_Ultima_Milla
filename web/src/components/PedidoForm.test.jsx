import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { manejadoresMapa } from 'react-leaflet'
import { fechaIso } from '../hooks/fechas'
import PedidoForm from './PedidoForm'

function clicEnMapa(lat, lng) {
  act(() => manejadoresMapa.actual.click({ latlng: { lat, lng } }))
}

async function llenarFormulario(user) {
  await user.type(screen.getByLabelText('Nombres del cliente'), 'Maria Torres')
  await user.type(screen.getByLabelText('Teléfono'), '0982000001')
  await user.type(screen.getByLabelText('Dirección de entrega'), 'Bolívar y Mera')
  await user.type(screen.getByLabelText('Hora aproximada'), '10:30')
  await user.selectOptions(screen.getByLabelText('Prioridad'), 'ALTA')
}

// Hora del servidor simulada. Las fechas son fijas y distintas de las del computador: si el formulario usara el reloj
// del computador en lugar de esta respuesta, las pruebas fallarían.
const HORA_SERVIDOR = {
  fecha: '2031-05-17',
  hora: '19:15:00',
  zonaHoraria: 'America/Guayaquil',
  anticipacionMinimaMinutos: 30,
  entregaMinimaFecha: '2031-05-17',
  entregaMinimaHora: '19:45:00',
}
const MENSAJE_HORA = 'La hora de entrega debe ser al menos 30 minutos después de la hora actual del servidor, 19:15'

const PEDIDO_EXISTENTE = {
  id: 7,
  clienteId: 3,
  clienteNombres: 'Luis Mora',
  clienteTelefono: '0991112223',
  direccion: 'Cevallos y Sucre',
  latitud: -1.2412,
  longitud: -78.6197,
  fechaEntrega: fechaIso(1),
  horaEntrega: '14:30:00',
  prioridad: 'URGENTE',
}

describe('PedidoForm', () => {
  test('todos los campos se encuentran por su label', () => {
    render(<PedidoForm onSubmit={jest.fn()} />)

    for (const etiqueta of [
      'Nombres del cliente',
      'Teléfono',
      'Email (opcional)',
      'Dirección de entrega',
      'Latitud',
      'Longitud',
      'Fecha de entrega',
      'Hora aproximada',
      'Prioridad',
    ]) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument()
    }
  })

  test('latitud y longitud son de solo lectura y se llenan con un clic en el mapa', () => {
    render(<PedidoForm onSubmit={jest.fn()} />)
    expect(screen.getByLabelText('Latitud')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Longitud')).toHaveAttribute('readonly')

    clicEnMapa(-1.2412, -78.6197)

    expect(screen.getByLabelText('Latitud')).toHaveValue('-1.241200')
    expect(screen.getByLabelText('Longitud')).toHaveValue('-78.619700')
    expect(screen.getByTestId('marcador-circulo')).toBeInTheDocument()
  })

  test('al enviar entrega los datos del pedido a onSubmit', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} />)

    await llenarFormulario(user)
    clicEnMapa(-1.2412, -78.6197)
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteNombres: 'Maria Torres',
        clienteTelefono: '0982000001',
        direccion: 'Bolívar y Mera',
        latitud: -1.2412,
        longitud: -78.6197,
        horaEntrega: '10:30',
        prioridad: 'ALTA',
      }),
    )
    // el email es opcional: si no se escribe, no se envia
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('clienteEmail')
  })

  test('envía el email cuando se escribe', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} />)

    await llenarFormulario(user)
    await user.type(screen.getByLabelText('Email (opcional)'), 'maria@correo.com')
    clicEnMapa(-1.24, -78.62)
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit.mock.calls[0][0].clienteEmail).toBe('maria@correo.com')
  })

  test('no envia el formulario si faltan campos obligatorios', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('exige elegir la ubicación en el mapa', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} />)

    await llenarFormulario(user)
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Haga clic en el mapa para indicar la ubicación de entrega')
  })

  test('rechaza una fecha de entrega anterior a hoy (CP-04)', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} horaServidor={HORA_SERVIDOR} />)

    await llenarFormulario(user)
    clicEnMapa(-1.2412, -78.6197)
    fireEvent.change(screen.getByLabelText('Fecha de entrega'), { target: { value: '2031-05-16' } })
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('La fecha de entrega no puede ser anterior a hoy')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de entrega')).toHaveAttribute('aria-invalid', 'true')
  })

  test('muestra el error del backend y bloquea el boton mientras guarda', () => {
    render(<PedidoForm onSubmit={jest.fn()} enviando error="La dirección no corresponde a ninguna zona configurada" />)

    expect(screen.getByRole('alert')).toHaveTextContent('La dirección no corresponde a ninguna zona configurada')
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })

  test('dibuja las zonas activas como referencia en el mapa', () => {
    const zonas = [{ id: 1, nombre: 'Centro', area: { type: 'Polygon', coordinates: [] } }]
    render(<PedidoForm onSubmit={jest.fn()} zonas={zonas} />)

    expect(screen.getByTestId('geojson')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toHaveTextContent('Centro')
  })

  describe('con la hora del servidor', () => {
    const fecha = () => screen.getByLabelText('Fecha de entrega')
    const hora = () => screen.getByLabelText('Hora aproximada')

    function elegir(campo, valor) {
      fireEvent.change(campo(), { target: { value: valor } })
    }

    test('la fecha por defecto y la fecha mínima salen del servidor, no del computador', () => {
      render(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      expect(fecha()).toHaveValue('2031-05-17')
      expect(fecha()).toHaveAttribute('min', '2031-05-17')
    })

    test('si la hora del servidor llega con el formulario ya abierto, la fecha por defecto se actualiza', () => {
      const { rerender } = render(<PedidoForm onSubmit={jest.fn()} horaServidor={null} />)
      expect(fecha()).toHaveValue(fechaIso(0)) // mientras tanto, solo como valor inicial: el backend valida

      rerender(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      expect(fecha()).toHaveValue('2031-05-17')
    })

    test('una fecha elegida por el usuario no se pisa cuando llega la hora del servidor', () => {
      const { rerender } = render(<PedidoForm onSubmit={jest.fn()} horaServidor={null} />)
      elegir(fecha, '2031-06-01')

      rerender(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      expect(fecha()).toHaveValue('2031-06-01')
    })

    test('cerca de la medianoche la fecha por defecto y la mínima pasan a mañana', () => {
      const casiMedianoche = {
        ...HORA_SERVIDOR,
        hora: '23:50:00',
        entregaMinimaFecha: '2031-05-18',
        entregaMinimaHora: '00:20:00',
      }
      render(<PedidoForm onSubmit={jest.fn()} horaServidor={casiMedianoche} />)

      expect(fecha()).toHaveValue('2031-05-18')
      expect(fecha()).toHaveAttribute('min', '2031-05-18')
      expect(hora()).toHaveAttribute('min', '00:20')
    })

    test('si la fecha es hoy, la hora mínima es la hora del servidor más la anticipación', () => {
      render(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      expect(hora()).toHaveAttribute('min', '19:45')
    })

    test('si la fecha es otro día, la hora no tiene mínima', () => {
      render(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      elegir(fecha, '2031-05-18')

      expect(hora()).not.toHaveAttribute('min')
    })

    test('hoy con una hora pasada avisa con el mensaje del servidor y no deja enviar', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<PedidoForm onSubmit={onSubmit} horaServidor={HORA_SERVIDOR} />)

      await llenarFormulario(user)
      clicEnMapa(-1.2412, -78.6197)
      elegir(hora, '07:00')

      expect(screen.getByText(MENSAJE_HORA)).toBeInTheDocument()
      expect(hora()).toHaveAttribute('aria-invalid', 'true')
      await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))
      expect(onSubmit).not.toHaveBeenCalled()
    })

    test('hoy con una hora dentro de la anticipación avisa (19:44) y en el límite (19:45) no', () => {
      render(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      elegir(hora, '19:44')
      expect(screen.getByText(MENSAJE_HORA)).toBeInTheDocument()

      elegir(hora, '19:45')
      expect(screen.queryByText(MENSAJE_HORA)).not.toBeInTheDocument()
      expect(hora()).toHaveAttribute('aria-invalid', 'false')
    })

    test('el aviso desaparece al pasar a mañana, donde cualquier hora vale', () => {
      render(<PedidoForm onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)
      elegir(hora, '07:00')
      expect(screen.getByText(MENSAJE_HORA)).toBeInTheDocument()

      elegir(fecha, '2031-05-18')

      expect(screen.queryByText(MENSAJE_HORA)).not.toBeInTheDocument()
    })

    test('hoy con una hora válida se envía con la fecha del servidor', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<PedidoForm onSubmit={onSubmit} horaServidor={HORA_SERVIDOR} />)

      await llenarFormulario(user) // la hora que escribe llenarFormulario (10:30) es anterior: se corrige
      clicEnMapa(-1.2412, -78.6197)
      elegir(hora, '20:00')
      await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ fechaEntrega: '2031-05-17', horaEntrega: '20:00' }),
      )
    })

    test('mañana a cualquier hora se envía', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<PedidoForm onSubmit={onSubmit} horaServidor={HORA_SERVIDOR} />)

      await llenarFormulario(user)
      clicEnMapa(-1.2412, -78.6197)
      elegir(fecha, '2031-05-18')
      elegir(hora, '07:00')
      await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ fechaEntrega: '2031-05-18', horaEntrega: '07:00' }),
      )
    })

    test('al editar también aplica la hora del servidor', () => {
      const pedido = { ...PEDIDO_EXISTENTE, fechaEntrega: '2031-05-17', horaEntrega: '08:00:00' }
      render(<PedidoForm pedido={pedido} onSubmit={jest.fn()} horaServidor={HORA_SERVIDOR} />)

      expect(hora()).toHaveAttribute('min', '19:45')
      expect(screen.getByText(MENSAJE_HORA)).toBeInTheDocument()
    })

    test('sin respuesta del servidor no valida fecha ni hora: el backend decide y muestra su mensaje', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<PedidoForm onSubmit={onSubmit} horaServidor={null} error={MENSAJE_HORA} />)

      await llenarFormulario(user)
      clicEnMapa(-1.2412, -78.6197)
      elegir(fecha, '2001-01-01')
      await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

      expect(fecha()).not.toHaveAttribute('min')
      expect(hora()).not.toHaveAttribute('min')
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ fechaEntrega: '2001-01-01', horaEntrega: '10:30' }),
      )
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_HORA)
    })
  })

  describe('al editar un pedido', () => {
    test('carga sus datos y muestra su marcador', () => {
      render(<PedidoForm pedido={PEDIDO_EXISTENTE} onSubmit={jest.fn()} />)

      expect(screen.getByRole('form', { name: 'Editar pedido' })).toBeInTheDocument()
      expect(screen.getByLabelText('Nombres del cliente')).toHaveValue('Luis Mora')
      expect(screen.getByLabelText('Dirección de entrega')).toHaveValue('Cevallos y Sucre')
      expect(screen.getByLabelText('Hora aproximada')).toHaveValue('14:30')
      expect(screen.getByLabelText('Prioridad')).toHaveValue('URGENTE')
      expect(screen.getByLabelText('Latitud')).toHaveValue('-1.2412')
      expect(screen.getByTestId('marcador-circulo')).toBeInTheDocument()
    })

    test('si el cliente no cambió envía solo su id (no pierde el email)', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<PedidoForm pedido={PEDIDO_EXISTENTE} onSubmit={onSubmit} />)

      await user.clear(screen.getByLabelText('Dirección de entrega'))
      await user.type(screen.getByLabelText('Dirección de entrega'), 'Nueva dirección')
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

      const datos = onSubmit.mock.calls[0][0]
      expect(datos.clienteId).toBe(3)
      expect(datos).not.toHaveProperty('clienteNombres')
      expect(datos.direccion).toBe('Nueva dirección')
    })

    test('si el cliente cambió envía sus nombres y teléfono', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<PedidoForm pedido={PEDIDO_EXISTENTE} onSubmit={onSubmit} />)

      await user.clear(screen.getByLabelText('Teléfono'))
      await user.type(screen.getByLabelText('Teléfono'), '0990000000')
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

      const datos = onSubmit.mock.calls[0][0]
      expect(datos).not.toHaveProperty('clienteId')
      expect(datos).toEqual(expect.objectContaining({ clienteNombres: 'Luis Mora', clienteTelefono: '0990000000' }))
    })

    test('el botón Cancelar avisa a quien lo usa', async () => {
      const user = userEvent.setup()
      const onCancelar = jest.fn()
      render(<PedidoForm pedido={PEDIDO_EXISTENTE} onSubmit={jest.fn()} onCancelar={onCancelar} />)

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalled()
    })
  })
})
