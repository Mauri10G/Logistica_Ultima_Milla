import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ETIQUETAS_ESTADO } from '../utils/estados'
import Avisos, { DURACION_ERROR_MS, DURACION_OK_MS } from './Avisos'
import Cargando, { FilasCarga } from './Cargando'
import EncabezadoPagina from './EncabezadoPagina'
import EstadoBadge from './EstadoBadge'
import EstadoVacio from './EstadoVacio'
import Logo from './Logo'

describe('EncabezadoPagina', () => {
  test('muestra el título como h1, la descripción y las acciones a la derecha', () => {
    render(
      <EncabezadoPagina titulo="Pedidos" descripcion="Registre pedidos.">
        <button type="button">Nuevo pedido</button>
      </EncabezadoPagina>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getByText('Registre pedidos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toBeInTheDocument()
  })

  test('sin descripción ni acciones solo dibuja el título', () => {
    const { container } = render(<EncabezadoPagina titulo="Zonas" />)

    expect(container.querySelector('.encabezado-descripcion')).toBeNull()
    expect(container.querySelector('.encabezado-acciones')).toBeNull()
  })
})

describe('EstadoVacio', () => {
  test('muestra el título y la ayuda', () => {
    render(<EstadoVacio titulo="No hay datos." ayuda="Pruebe otro filtro." />)

    expect(screen.getByText('No hay datos.')).toBeInTheDocument()
    expect(screen.getByText('Pruebe otro filtro.')).toBeInTheDocument()
  })

  test('la ayuda es opcional', () => {
    const { container } = render(<EstadoVacio titulo="Vacío" />)

    expect(container.querySelector('.estado-vacio-ayuda')).toBeNull()
  })
})

describe('Cargando', () => {
  test('muestra el texto de carga sin usar role="status"', () => {
    render(<Cargando texto="Cargando rutas…" bloque />)

    expect(screen.getByText('Cargando rutas…')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('FilasCarga dibuja filas de esqueleto con un texto solo para lectores de pantalla', () => {
    render(
      <table>
        <tbody>
          <FilasCarga columnas={4} filas={3} />
        </tbody>
      </table>,
    )

    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('Cargando datos…')).toHaveClass('solo-lectores')
  })
})

describe('Logo y EstadoBadge', () => {
  test('el logo es decorativo', () => {
    const { container } = render(<Logo />)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  test('cada estado tiene etiqueta y clase de color', () => {
    for (const [estado, etiqueta] of Object.entries(ETIQUETAS_ESTADO)) {
      const { unmount } = render(<EstadoBadge estado={estado} />)
      expect(screen.getByText(etiqueta)).toHaveClass(`badge-${estado}`)
      unmount()
    }
  })

  test('un estado desconocido se muestra tal cual', () => {
    render(<EstadoBadge estado="OTRO" />)

    expect(screen.getByText('OTRO')).toHaveClass('badge-OTRO')
  })
})

describe('Avisos', () => {
  afterEach(() => jest.useRealTimers())

  test('el éxito es role="status" y el error es role="alert"', () => {
    render(<Avisos mensaje="Pedido registrado." error="Falló" onCerrarMensaje={jest.fn()} onCerrarError={jest.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Pedido registrado.')
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
  })

  test('sin mensajes no dibuja avisos', () => {
    render(<Avisos mensaje={null} error={null} onCerrarMensaje={jest.fn()} onCerrarError={jest.fn()} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('el éxito desaparece solo a los 5 s y el error a los 9 s', () => {
    jest.useFakeTimers()
    const onCerrarMensaje = jest.fn()
    const onCerrarError = jest.fn()
    render(<Avisos mensaje="Listo" error="Falló" onCerrarMensaje={onCerrarMensaje} onCerrarError={onCerrarError} />)

    act(() => jest.advanceTimersByTime(DURACION_OK_MS - 1))
    expect(onCerrarMensaje).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(onCerrarMensaje).toHaveBeenCalledTimes(1)
    expect(onCerrarError).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(DURACION_ERROR_MS - DURACION_OK_MS))
    expect(onCerrarError).toHaveBeenCalledTimes(1)
  })

  test('un mensaje nuevo reinicia el temporizador', () => {
    jest.useFakeTimers()
    const onCerrarMensaje = jest.fn()
    const { rerender } = render(<Avisos mensaje="Uno" onCerrarMensaje={onCerrarMensaje} />)

    act(() => jest.advanceTimersByTime(DURACION_OK_MS - 100))
    rerender(<Avisos mensaje="Dos" onCerrarMensaje={onCerrarMensaje} />)
    act(() => jest.advanceTimersByTime(DURACION_OK_MS - 100))
    expect(onCerrarMensaje).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(100))
    expect(onCerrarMensaje).toHaveBeenCalledTimes(1)
  })

  test('al desmontar se cancela el temporizador', () => {
    jest.useFakeTimers()
    const onCerrarMensaje = jest.fn()
    const { unmount } = render(<Avisos mensaje="Listo" onCerrarMensaje={onCerrarMensaje} />)

    unmount()
    act(() => jest.advanceTimersByTime(DURACION_ERROR_MS))

    expect(onCerrarMensaje).not.toHaveBeenCalled()
  })

  test('la X cierra el aviso', async () => {
    const user = userEvent.setup()
    const onCerrarError = jest.fn()
    render(<Avisos error="Falló" onCerrarError={onCerrarError} />)

    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(onCerrarError).toHaveBeenCalledTimes(1)
  })
})
