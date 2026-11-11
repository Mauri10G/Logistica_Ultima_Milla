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
    render(<PedidoForm onSubmit={onSubmit} />)

    await llenarFormulario(user)
    clicEnMapa(-1.2412, -78.6197)
    fireEvent.change(screen.getByLabelText('Fecha de entrega'), { target: { value: fechaIso(-1) } })
    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha de entrega no puede ser anterior a hoy')
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
