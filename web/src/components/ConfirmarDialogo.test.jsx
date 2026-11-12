import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmarDialogo from './ConfirmarDialogo'

function dibujar(props = {}) {
  const onConfirmar = props.onConfirmar ?? jest.fn()
  const onCancelar = props.onCancelar ?? jest.fn()
  const resultado = render(
    <ConfirmarDialogo
      titulo="¿Eliminar el pedido 732?"
      descripcion="El pedido desaparecerá de la lista."
      detalles={[
        ['Cliente', 'Ana Ruiz'],
        ['Dirección', 'Montalvo y Bolívar'],
        ['Entrega', '18/05/2031 10:00'],
      ]}
      textoConfirmar="Eliminar pedido"
      {...props}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />,
  )
  return { onConfirmar, onCancelar, ...resultado }
}

describe('ConfirmarDialogo: accesibilidad', () => {
  test('es un alertdialog modal con el título como nombre y el contenido como descripción', () => {
    dibujar()

    const dialogo = screen.getByRole('alertdialog', { name: '¿Eliminar el pedido 732?' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveAccessibleDescription(/El pedido desaparecerá de la lista\..*Ana Ruiz.*Montalvo y Bolívar/)
    expect(dialogo.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialogo.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('muestra los datos afectados como lista de términos y valores', () => {
    dibujar()

    expect(screen.getByText('Cliente', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText('Ana Ruiz', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Entrega', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText('18/05/2031 10:00', { selector: 'dd' })).toBeInTheDocument()
  })

  test('sin detalles ni descripción solo muestra el título y los botones', () => {
    render(
      <ConfirmarDialogo titulo="¿Seguro?" textoConfirmar="Sí, seguir" onConfirmar={jest.fn()} onCancelar={jest.fn()} />,
    )

    expect(screen.queryByRole('term')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sí, seguir' })).toBeInTheDocument()
  })
})

describe('ConfirmarDialogo: variantes', () => {
  test('peligro (por defecto): ícono de alerta y botón rojo con el verbo exacto', () => {
    dibujar()

    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toHaveClass('peligro')
    expect(document.querySelector('.confirmar-icono-peligro svg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aceptar/i })).not.toBeInTheDocument()
  })

  test('advertencia usa el botón ámbar y normal el botón principal', () => {
    const { unmount } = dibujar({ variante: 'advertencia' })
    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toHaveClass('advertencia')
    unmount()

    dibujar({ variante: 'normal' })
    const boton = screen.getByRole('button', { name: 'Eliminar pedido' })
    expect(boton).not.toHaveClass('peligro')
    expect(boton).not.toHaveClass('advertencia')
    expect(document.querySelector('.confirmar-icono-normal')).toBeInTheDocument()
  })

  test('el texto de Cancelar se puede cambiar', () => {
    dibujar({ textoCancelar: 'Seguir editando' })
    expect(screen.getByRole('button', { name: 'Seguir editando' })).toBeInTheDocument()
  })
})

describe('ConfirmarDialogo: teclado', () => {
  test('el foco empieza en Cancelar, no en el botón de la acción', () => {
    dibujar()

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  test('Enter con el foco inicial cancela: no ejecuta la acción', async () => {
    const user = userEvent.setup()
    const { onConfirmar, onCancelar } = dibujar()

    await user.keyboard('{Enter}')

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  test('Esc cancela', async () => {
    const user = userEvent.setup()
    const { onConfirmar, onCancelar } = dibujar()

    await user.keyboard('{Escape}')

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  test('Tab no saca el foco del diálogo', async () => {
    const user = userEvent.setup()
    dibujar()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  test('el foco vuelve al botón que abrió el diálogo al cerrarse', () => {
    const origen = document.createElement('button')
    document.body.appendChild(origen)
    origen.focus()
    const { unmount } = dibujar()

    unmount()

    expect(origen).toHaveFocus()
    origen.remove()
  })
})

describe('ConfirmarDialogo: confirmar', () => {
  test('pulsar el botón de la acción llama a onConfirmar', async () => {
    const user = userEvent.setup()
    const { onConfirmar, onCancelar } = dibujar()

    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).not.toHaveBeenCalled()
  })

  test('Cancelar llama a onCancelar', async () => {
    const user = userEvent.setup()
    const { onConfirmar, onCancelar } = dibujar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  test('con una acción asíncrona el botón muestra que carga, no se pulsa dos veces y no se puede cancelar', async () => {
    const user = userEvent.setup()
    let terminar
    const onConfirmar = jest.fn(() => new Promise((resolver) => (terminar = resolver)))
    const { onCancelar } = dibujar({ onConfirmar, textoCargando: 'Eliminando…' })

    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }))

    const cargando = screen.getByRole('button', { name: 'Eliminando…' })
    expect(cargando).toBeDisabled()
    expect(cargando).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await user.click(cargando)
    await user.keyboard('{Escape}')
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).not.toHaveBeenCalled()

    await act(async () => terminar())

    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
  })

  test('si la acción asíncrona falla, el diálogo se vuelve a habilitar sin romper nada', async () => {
    const user = userEvent.setup()
    let fallar
    const onConfirmar = jest.fn(() => new Promise((_resolver, rechazar) => (fallar = rechazar)))
    dibujar({ onConfirmar })
    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }))

    await act(async () => fallar(new Error('falló')))

    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toBeEnabled()
  })

  test('si se desmonta mientras la acción corre, no intenta actualizarse', async () => {
    const user = userEvent.setup()
    let terminar
    const onConfirmar = jest.fn(() => new Promise((resolver) => (terminar = resolver)))
    const { unmount } = dibujar({ onConfirmar })
    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }))
    unmount()

    await expect(act(async () => terminar())).resolves.not.toThrow()
  })
})
