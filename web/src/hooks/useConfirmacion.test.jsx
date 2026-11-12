import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConfirmacion } from './useConfirmacion'

let resultados

function Prueba({ opciones = {} }) {
  const { pedir, dialogo } = useConfirmacion()
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          resultados.push(await pedir({ titulo: '¿Seguro?', textoConfirmar: 'Sí, hacerlo', ...opciones }))
        }}
      >
        Abrir
      </button>
      {dialogo}
    </div>
  )
}

beforeEach(() => {
  resultados = []
})

describe('useConfirmacion', () => {
  test('no muestra nada hasta que se pide una confirmación', () => {
    render(<Prueba />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('confirmar resuelve la promesa con true y cierra el diálogo', async () => {
    const user = userEvent.setup()
    render(<Prueba />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('alertdialog', { name: '¿Seguro?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sí, hacerlo' }))

    await waitFor(() => expect(resultados).toEqual([true]))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('Cancelar y Esc resuelven con false', async () => {
    const user = userEvent.setup()
    render(<Prueba />)

    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await user.keyboard('{Escape}')

    await waitFor(() => expect(resultados).toEqual([false, false]))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('con onConfirmar el diálogo queda cargando hasta que termina y recién ahí resuelve true', async () => {
    const user = userEvent.setup()
    let terminar
    const onConfirmar = jest.fn(() => new Promise((resolver) => (terminar = resolver)))
    render(<Prueba opciones={{ onConfirmar, textoCargando: 'Guardando…' }} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    await user.click(screen.getByRole('button', { name: 'Sí, hacerlo' }))

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(resultados).toEqual([])
    await act(async () => terminar())
    await waitFor(() => expect(resultados).toEqual([true]))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  test('si onConfirmar falla, el diálogo se cierra y la promesa da false', async () => {
    const user = userEvent.setup()
    render(<Prueba opciones={{ onConfirmar: jest.fn().mockRejectedValue(new Error('falló')) }} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    await user.click(screen.getByRole('button', { name: 'Sí, hacerlo' }))

    await waitFor(() => expect(resultados).toEqual([false]))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('cancelar no llama a onConfirmar', async () => {
    const user = userEvent.setup()
    const onConfirmar = jest.fn()
    render(<Prueba opciones={{ onConfirmar }} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))

    expect(onConfirmar).not.toHaveBeenCalled()
  })

  test('pedir otra confirmación con una abierta da por cancelada la primera', async () => {
    let pedirExterno
    function Doble() {
      const { pedir, dialogo } = useConfirmacion()
      pedirExterno = pedir
      return dialogo
    }
    render(<Doble />)
    let primera
    let segunda
    act(() => {
      primera = pedirExterno({ titulo: 'Primera', textoConfirmar: 'Uno' })
    })
    act(() => {
      segunda = pedirExterno({ titulo: 'Segunda', textoConfirmar: 'Dos' })
    })

    await expect(primera).resolves.toBe(false)
    expect(screen.getByRole('alertdialog', { name: 'Segunda' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dos' }))
    await expect(segunda).resolves.toBe(true)
  })
})
