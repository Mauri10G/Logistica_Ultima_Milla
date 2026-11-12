import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
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

describe('Modal: confirmaciones y modales apilados', () => {
  test('rol="alertdialog" con aria-describedby apuntando a su descripción', () => {
    render(
      <Modal titulo="¿Eliminar?" onCerrar={jest.fn()} rol="alertdialog" idDescripcion="descripcion-modal">
        <p id="descripcion-modal">Se borrará el pedido.</p>
      </Modal>,
    )

    const dialogo = screen.getByRole('alertdialog', { name: '¿Eliminar?' })
    expect(dialogo).toHaveAttribute('aria-describedby', 'descripcion-modal')
    expect(dialogo).toHaveAccessibleDescription('Se borrará el pedido.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('sin idDescripcion no lleva aria-describedby y por defecto es un dialog', () => {
    dibujar()

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).not.toHaveAttribute('aria-describedby')
  })

  test('el foco inicial puede ir a un elemento elegido en vez del primer campo', () => {
    function ConFoco() {
      const ref = useRef(null)
      return (
        <Modal titulo="Con foco" onCerrar={jest.fn()} foco={ref}>
          <input aria-label="Campo" />
          <button ref={ref} type="button">
            Cancelar
          </button>
        </Modal>
      )
    }
    render(<ConFoco />)

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  test('la clase extra se agrega al diálogo', () => {
    render(
      <Modal titulo="Angosto" onCerrar={jest.fn()} clase="modal-confirmar">
        <p>x</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveClass('modal', 'modal-confirmar')
  })

  test('con dos modales abiertos, Esc solo cierra el de encima', async () => {
    const user = userEvent.setup()
    const cerrarFondo = jest.fn()
    const cerrarEncima = jest.fn()
    render(
      <>
        <Modal titulo="Formulario" onCerrar={cerrarFondo}>
          <input aria-label="Campo del formulario" />
        </Modal>
        <Modal titulo="Confirmar" onCerrar={cerrarEncima} rol="alertdialog">
          <button type="button">Cancelar</button>
        </Modal>
      </>,
    )

    await user.keyboard('{Escape}')

    expect(cerrarEncima).toHaveBeenCalledTimes(1)
    expect(cerrarFondo).not.toHaveBeenCalled()
  })

  test('al cerrarse el de encima, Esc vuelve a cerrar el de abajo y el scroll sigue bloqueado hasta el final', async () => {
    const user = userEvent.setup()
    const cerrarFondo = jest.fn()
    function Dos({ conConfirmacion }) {
      return (
        <>
          <Modal titulo="Formulario" onCerrar={cerrarFondo}>
            <input aria-label="Campo del formulario" />
          </Modal>
          {conConfirmacion && (
            <Modal titulo="Confirmar" onCerrar={jest.fn()} rol="alertdialog">
              <button type="button">Cancelar</button>
            </Modal>
          )}
        </>
      )
    }
    const { rerender, unmount } = render(<Dos conConfirmacion />)

    rerender(<Dos conConfirmacion={false} />)
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')

    expect(cerrarFondo).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  test('el foco vuelve al campo del formulario al cerrarse la confirmación', () => {
    function Dos({ conConfirmacion }) {
      return (
        <>
          <Modal titulo="Formulario" onCerrar={jest.fn()}>
            <input aria-label="Campo del formulario" />
          </Modal>
          {conConfirmacion && (
            <Modal titulo="Confirmar" onCerrar={jest.fn()} rol="alertdialog">
              <button type="button">Cancelar</button>
            </Modal>
          )}
        </>
      )
    }
    const { rerender } = render(<Dos conConfirmacion={false} />)
    expect(screen.getByLabelText('Campo del formulario')).toHaveFocus()
    rerender(<Dos conConfirmacion />)
    expect(screen.getByRole('alertdialog')).toHaveFocus() // sin campos, el foco queda en el propio diálogo

    rerender(<Dos conConfirmacion={false} />)

    expect(screen.getByLabelText('Campo del formulario')).toHaveFocus()
  })

  test('si se cierran los dos a la vez, en cualquier orden, la página queda desbloqueada', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = render(
      <>
        <Modal titulo="Formulario" onCerrar={jest.fn()}>
          <input aria-label="Campo" />
        </Modal>
        <Modal titulo="Confirmar" onCerrar={jest.fn()} rol="alertdialog">
          <button type="button">Cancelar</button>
        </Modal>
      </>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('scroll')
    document.body.style.overflow = ''
  })
})
