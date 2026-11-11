import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

function Contenido() {
  return (
    <form>
      <input aria-label="Solo lectura" readOnly defaultValue="x" />
      <input aria-label="Primer campo" />
      <button type="button">Cancelar</button>
      <button type="submit">Guardar</button>
    </form>
  )
}

function dibujar(props = {}) {
  const onCerrar = props.onCerrar ?? jest.fn()
  const resultado = render(
    <Modal titulo="Nuevo pedido" onCerrar={onCerrar}>
      <Contenido />
    </Modal>,
  )
  return { onCerrar, ...resultado }
}

describe('Modal', () => {
  test('es un diálogo modal accesible con el título como nombre', () => {
    dibujar()

    const dialogo = screen.getByRole('dialog', { name: 'Nuevo pedido' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Nuevo pedido' })).toHaveAttribute('id', dialogo.getAttribute('aria-labelledby'))
  })

  test('se dibuja sobre la página (en document.body), no dentro de su contenedor', () => {
    const { container } = dibujar()

    expect(container).toBeEmptyDOMElement()
    expect(screen.getByRole('dialog').parentElement.parentElement).toBe(document.body)
  })

  test('el foco va al primer campo editable (no al de solo lectura)', () => {
    dibujar()
    expect(screen.getByLabelText('Primer campo')).toHaveFocus()
  })

  test('si no hay campos el foco queda en el propio diálogo', () => {
    render(
      <Modal titulo="Aviso" onCerrar={jest.fn()}>
        <p>Solo texto</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  test('Esc lo cierra', async () => {
    const user = userEvent.setup()
    const { onCerrar } = dibujar()

    await user.keyboard('{Escape}')

    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  test('Esc usa el onCerrar más reciente', async () => {
    const user = userEvent.setup()
    const primero = jest.fn()
    const segundo = jest.fn()
    const { rerender } = render(
      <Modal titulo="T" onCerrar={primero}>
        <Contenido />
      </Modal>,
    )

    rerender(
      <Modal titulo="T" onCerrar={segundo}>
        <Contenido />
      </Modal>,
    )
    await user.keyboard('{Escape}')

    expect(primero).not.toHaveBeenCalled()
    expect(segundo).toHaveBeenCalledTimes(1)
  })

  test('hacer clic fuera no lo cierra (para no perder lo escrito)', async () => {
    const user = userEvent.setup()
    const { onCerrar } = dibujar()

    await user.click(screen.getByRole('dialog').parentElement)

    expect(onCerrar).not.toHaveBeenCalled()
  })

  test('Tab no sale del diálogo: del último botón vuelve al primer campo', async () => {
    const user = userEvent.setup()
    dibujar()
    screen.getByRole('button', { name: 'Guardar' }).focus()

    await user.tab()

    expect(screen.getByLabelText('Solo lectura')).toHaveFocus()
  })

  test('Shift+Tab desde el primer elemento salta al último', async () => {
    const user = userEvent.setup()
    dibujar()
    screen.getByLabelText('Solo lectura').focus()

    await user.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus()
  })

  test('si el foco estaba fuera, Tab lo devuelve al diálogo', async () => {
    const user = userEvent.setup()
    dibujar()
    screen.getByRole('dialog').blur()
    document.body.focus()

    await user.tab()

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement)
  })

  test('bloquea el scroll de la página mientras está abierto y lo restaura al cerrar', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = dibujar()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  test('al cerrar devuelve el foco al elemento que lo abrió', () => {
    const boton = document.createElement('button')
    document.body.appendChild(boton)
    boton.focus()
    const { unmount } = dibujar()
    expect(boton).not.toHaveFocus()

    unmount()

    expect(boton).toHaveFocus()
    boton.remove()
  })

  test('si el elemento que lo abrió ya no existe, no falla al cerrar', () => {
    const boton = document.createElement('button')
    document.body.appendChild(boton)
    boton.focus()
    const { unmount } = dibujar()
    boton.remove()

    expect(() => unmount()).not.toThrow()
  })

  test('deja de escuchar el teclado al cerrarse', async () => {
    const user = userEvent.setup()
    const { onCerrar, unmount } = dibujar()
    unmount()

    await user.keyboard('{Escape}')

    expect(onCerrar).not.toHaveBeenCalled()
  })
})
