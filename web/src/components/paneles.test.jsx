import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EstadoBadge from './EstadoBadge'
import HistorialPedido from './HistorialPedido'
import IndicadorConexion from './IndicadorConexion'

describe('EstadoBadge', () => {
  test('muestra la etiqueta en español', () => {
    render(<EstadoBadge estado="EN_CAMINO" />)
    expect(screen.getByText('En camino')).toHaveClass('badge-EN_CAMINO')
  })

  test('un estado desconocido se muestra tal cual', () => {
    render(<EstadoBadge estado="OTRO" />)
    expect(screen.getByText('OTRO')).toBeInTheDocument()
  })
})

describe('IndicadorConexion', () => {
  test('conectado', () => {
    render(<IndicadorConexion conectado />)
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: conectado')
    expect(screen.getByRole('status')).toHaveClass('conexion-ok')
  })

  test('desconectado', () => {
    render(<IndicadorConexion conectado={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Tiempo real: desconectado')
    expect(screen.getByRole('status')).toHaveClass('conexion-error')
  })
})

describe('HistorialPedido', () => {
  const pedido = { id: 8, clienteNombres: 'Maria Torres', direccion: 'Bolívar y Mera' }

  test('muestra la línea de tiempo con estados, fecha y origen', () => {
    const historial = [
      { id: 1, estadoAnterior: null, estadoNuevo: 'PENDIENTE', fechaCambio: '2026-03-01T08:00:00', origen: 'WEB' },
      { id: 2, estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', fechaCambio: '2026-03-01T18:00:05', origen: 'WEB' },
      { id: 3, estadoAnterior: 'RECOGIDO', estadoNuevo: 'EN_CAMINO', fechaCambio: '2026-03-02T09:10:00', origen: 'MOVIL' },
    ]
    render(<HistorialPedido pedido={pedido} historial={historial} error={null} onCerrar={jest.fn()} />)

    expect(screen.getByRole('complementary', { name: 'Historial del pedido 8' })).toBeInTheDocument()
    expect(screen.getByText('Maria Torres · Bolívar y Mera')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Registro')).toBeInTheDocument()
    expect(screen.getByText('2026-03-01 18:00:05')).toBeInTheDocument()
    expect(screen.getByText('MOVIL')).toBeInTheDocument()
  })

  test('mientras carga muestra un aviso', () => {
    render(<HistorialPedido pedido={pedido} historial={null} error={null} onCerrar={jest.fn()} />)
    expect(screen.getByText('Cargando historial…')).toBeInTheDocument()
  })

  test('sin cambios muestra que está vacío', () => {
    render(<HistorialPedido pedido={pedido} historial={[]} error={null} onCerrar={jest.fn()} />)
    expect(screen.getByText('Este pedido aún no tiene cambios de estado.')).toBeInTheDocument()
  })

  test('muestra el error', () => {
    render(<HistorialPedido pedido={pedido} historial={null} error="No existe el pedido con id 8" onCerrar={jest.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No existe el pedido con id 8')
    expect(screen.queryByText('Cargando historial…')).not.toBeInTheDocument()
  })

  test('Cerrar historial avisa', async () => {
    const user = userEvent.setup()
    const onCerrar = jest.fn()
    render(<HistorialPedido pedido={pedido} historial={[]} error={null} onCerrar={onCerrar} />)

    await user.click(screen.getByRole('button', { name: 'Cerrar historial' }))

    expect(onCerrar).toHaveBeenCalled()
  })
})
