import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RutaCard from './RutaCard'

function crearRuta(extra = {}) {
  return {
    id: 5,
    zonaNombre: 'Centro',
    repartidorId: 1,
    repartidorNombre: 'Ana Pérez',
    estado: 'ARMADA',
    maxPedidos: 4,
    pedidos: [
      { id: 11, direccion: 'Calle A', horaEntrega: '09:00:00', estado: 'ASIGNADO' },
      { id: 12, direccion: 'Calle B', horaEntrega: '10:00:00', estado: 'ASIGNADO' },
      { id: 13, direccion: 'Calle C', horaEntrega: '11:00:00', estado: 'ASIGNADO' },
    ],
    ...extra,
  }
}

const REPARTIDORES = [
  { id: 1, nombres: 'Ana Pérez' },
  { id: 2, nombres: 'Luis Mora' },
]
const OTRAS = [{ id: 6, zonaNombre: 'Norte', maxPedidos: 4, pedidos: [{ id: 99 }] }]

function dibujar(props = {}) {
  const acciones = {
    onCambiarRepartidor: jest.fn(),
    onMover: jest.fn(),
    onSacar: jest.fn(),
    onReordenar: jest.fn(),
  }
  const ruta = props.ruta ?? crearRuta()
  render(<RutaCard ruta={ruta} color="#2563eb" repartidores={REPARTIDORES} otrasRutas={OTRAS} {...acciones} {...props} />)
  return { ruta, ...acciones }
}

async function ajustar(user) {
  await user.click(screen.getByRole('button', { name: 'Ajustar ruta' }))
}

describe('RutaCard: resumen compacto', () => {
  test('muestra repartidor, zona, pedidos y barra de capacidad, sin controles de ajuste', () => {
    dibujar()

    expect(screen.getByText('Ruta 5 · Centro')).toBeInTheDocument()
    expect(screen.getByText(/Repartidor: Ana Pérez · 3\/4 pedidos/)).toBeInTheDocument()
    expect(document.querySelector('.ruta-barra > span')).toHaveStyle({ width: '75%' })
    expect(screen.getByRole('button', { name: 'Ajustar ruta' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/Cambiar repartidor/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Subir|Bajar|Sacar/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Mover el pedido/)).not.toBeInTheDocument()
  })

  test('Ajustar ruta muestra los controles y Listo los oculta', async () => {
    const user = userEvent.setup()
    dibujar()

    await ajustar(user)
    expect(screen.getByLabelText('Cambiar repartidor de la ruta 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir la parada del pedido 12' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar ruta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Listo' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(screen.queryByLabelText(/Cambiar repartidor/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sacar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajustar ruta' })).toBeInTheDocument()
  })

  test('las paradas se siguen viendo sin ajustar', () => {
    dibujar()

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(/09:00 · Calle A/)).toBeInTheDocument()
  })

  test('el borde de la tarjeta lleva el color de la ruta', () => {
    dibujar({ color: '#16a34a' })

    expect(screen.getByTestId('ruta-card')).toHaveStyle({ borderLeftColor: '#16a34a' })
  })

  test('al pasar el mouse o el foco avisa qué ruta resaltar y al salir la suelta', async () => {
    const user = userEvent.setup()
    const onResaltar = jest.fn()
    dibujar({ onResaltar })

    await user.hover(screen.getByTestId('ruta-card'))
    expect(onResaltar).toHaveBeenLastCalledWith(5)
    await user.unhover(screen.getByTestId('ruta-card'))
    expect(onResaltar).toHaveBeenLastCalledWith(null)

    fireEvent.focus(screen.getByRole('button', { name: 'Ajustar ruta' }))
    expect(onResaltar).toHaveBeenLastCalledWith(5)
  })

  test('una ruta resaltada lo indica con una clase', () => {
    dibujar({ resaltada: true })

    expect(screen.getByTestId('ruta-card')).toHaveClass('ruta-resaltada')
  })
})

describe('RutaCard', () => {
  test('muestra la ruta, su repartidor, la ocupación y las paradas', () => {
    dibujar()

    expect(screen.getByText('Ruta 5 · Centro')).toBeInTheDocument()
    expect(screen.getByText(/Repartidor: Ana Pérez · 3\/4 pedidos/)).toBeInTheDocument()
    expect(screen.getByTestId('ruta-card')).toHaveAttribute('data-total', '3')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(/09:00 · Calle A/)).toBeInTheDocument()
  })

  test('cambiar el repartidor avisa con el id elegido', async () => {
    const user = userEvent.setup()
    const { ruta, onCambiarRepartidor } = dibujar()
    await ajustar(user)

    await user.selectOptions(screen.getByLabelText('Cambiar repartidor de la ruta 5'), '2')

    expect(onCambiarRepartidor).toHaveBeenCalledWith(ruta, 2)
  })

  test('si el repartidor actual no está disponible igual aparece en el select', async () => {
    const user = userEvent.setup()
    dibujar({ repartidores: [{ id: 2, nombres: 'Luis Mora' }] })
    await ajustar(user)

    const select = screen.getByLabelText('Cambiar repartidor de la ruta 5')
    expect(select).toHaveValue('1')
    expect(screen.getByRole('option', { name: 'Ana Pérez' })).toBeInTheDocument()
  })

  test('subir y bajar paradas envía el nuevo orden', async () => {
    const user = userEvent.setup()
    const { ruta, onReordenar } = dibujar()
    await ajustar(user)

    await user.click(screen.getByRole('button', { name: 'Subir la parada del pedido 12' }))
    expect(onReordenar).toHaveBeenLastCalledWith(ruta, [12, 11, 13])

    await user.click(screen.getByRole('button', { name: 'Bajar la parada del pedido 12' }))
    expect(onReordenar).toHaveBeenLastCalledWith(ruta, [11, 13, 12])
  })

  test('la primera parada no sube y la última no baja', async () => {
    const user = userEvent.setup()
    dibujar()
    await ajustar(user)

    expect(screen.getByRole('button', { name: 'Subir la parada del pedido 11' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar la parada del pedido 13' })).toBeDisabled()
  })

  test('sacar un pedido avisa con la ruta y el pedido', async () => {
    const user = userEvent.setup()
    const { ruta, onSacar } = dibujar()
    await ajustar(user)

    await user.click(screen.getByRole('button', { name: 'Sacar el pedido 13 de la ruta' }))

    expect(onSacar).toHaveBeenCalledWith(ruta, ruta.pedidos[2])
  })

  test('mover un pedido a otra ruta avisa con la ruta destino', async () => {
    const user = userEvent.setup()
    const { ruta, onMover } = dibujar()
    await ajustar(user)

    await user.selectOptions(screen.getByLabelText('Mover el pedido 11 a otra ruta'), '6')

    expect(onMover).toHaveBeenCalledWith(ruta, ruta.pedidos[0], 6)
    expect(screen.getAllByRole('option', { name: 'Ruta 6 · Norte (1/4)' })).toHaveLength(3)
  })

  test('sin otras rutas no se ofrece mover', async () => {
    const user = userEvent.setup()
    dibujar({ otrasRutas: [] })
    await ajustar(user)
    expect(screen.queryByLabelText(/Mover el pedido/)).not.toBeInTheDocument()
  })

  test('una ruta que ya salió (EN_CURSO) no se puede ajustar', () => {
    dibujar({ ruta: crearRuta({ estado: 'EN_CURSO' }) })

    expect(screen.queryByRole('button', { name: 'Ajustar ruta' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Cambiar repartidor/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sacar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Subir/ })).not.toBeInTheDocument()
  })

  test('mientras hay una operación en curso los controles se bloquean', async () => {
    const user = userEvent.setup()
    dibujar({ ocupado: true })
    await ajustar(user)

    expect(screen.getByLabelText('Cambiar repartidor de la ruta 5')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sacar el pedido 11 de la ruta' })).toBeDisabled()
    expect(screen.getByLabelText('Mover el pedido 11 a otra ruta')).toBeDisabled()
  })
})
