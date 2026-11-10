import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PedidoForm from './PedidoForm'

async function llenarFormulario(user) {
  await user.type(screen.getByLabelText('Nombres del cliente'), 'Maria Torres')
  await user.type(screen.getByLabelText('Teléfono'), '0982000001')
  await user.type(screen.getByLabelText('Dirección de entrega'), 'Bolívar y Mera')
  await user.type(screen.getByLabelText('Latitud'), '-1.2412')
  await user.type(screen.getByLabelText('Longitud'), '-78.6197')
  await user.type(screen.getByLabelText('Hora aproximada'), '10:30')
  await user.selectOptions(screen.getByLabelText('Prioridad'), 'ALTA')
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

  test('al enviar entrega los datos del pedido a onSubmit', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} />)

    await llenarFormulario(user)
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

  test('no envia el formulario si faltan campos obligatorios', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PedidoForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('muestra el error del backend y bloquea el boton mientras guarda', () => {
    render(<PedidoForm onSubmit={jest.fn()} enviando error="La dirección no corresponde a ninguna zona configurada" />)

    expect(screen.getByRole('alert')).toHaveTextContent('La dirección no corresponde a ninguna zona configurada')
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })
})
