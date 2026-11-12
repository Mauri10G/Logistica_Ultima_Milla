import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DURACION_DESHACER_MS, useAccionDeshacible } from './useAccionDeshacible'

let api // lo que expone el hook, para programar acciones desde las pruebas

function Prueba({ duracion }) {
  const { programar, avisosDeshacer } = useAccionDeshacible(duracion ? { duracion } : undefined)
  api = programar
  return <div>{avisosDeshacer}</div>
}

function programar(extra = {}) {
  const ejecutar = jest.fn().mockResolvedValue(undefined)
  const alDeshacer = jest.fn()
  act(() => {
    api({ mensaje: 'Pedido 732 eliminado', ejecutar, alDeshacer, ...extra })
  })
  return { ejecutar, alDeshacer }
}

const avanzar = (ms) => act(() => jest.advanceTimersByTime(ms))

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('useAccionDeshacible', () => {
  test('la duración por defecto es de 6 segundos', () => {
    expect(DURACION_DESHACER_MS).toBe(6000)
  })

  test('al programar muestra el aviso con Deshacer y una barra de 6 segundos, sin ejecutar nada', () => {
    render(<Prueba />)

    const { ejecutar } = programar()

    expect(screen.getByRole('status')).toHaveTextContent('Pedido 732 eliminado')
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
    expect(document.querySelector('.aviso-barra')).toHaveStyle({ animationDuration: '6000ms' })
    expect(ejecutar).not.toHaveBeenCalled()
  })

  test('ejecuta la acción recién al terminar el tiempo y quita el aviso', () => {
    render(<Prueba />)
    const { ejecutar, alDeshacer } = programar()

    avanzar(5999)
    expect(ejecutar).not.toHaveBeenCalled()
    avanzar(1)

    expect(ejecutar).toHaveBeenCalledTimes(1)
    expect(ejecutar).toHaveBeenCalledWith({ alSalir: false })
    expect(alDeshacer).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('Deshacer cancela la acción, avisa a la pantalla y quita el aviso', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<Prueba />)
    const { ejecutar, alDeshacer } = programar()

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    avanzar(20000)

    expect(alDeshacer).toHaveBeenCalledTimes(1)
    expect(ejecutar).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('cada acción tiene su propio aviso, su temporizador y su Deshacer', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<Prueba />)
    const primera = programar({ mensaje: 'Pedido 1 eliminado' })
    avanzar(2000)
    const segunda = programar({ mensaje: 'Pedido 2 eliminado' })

    expect(screen.getAllByRole('status')).toHaveLength(2)
    avanzar(4000) // la primera cumple sus 6 s; la segunda lleva 4
    expect(primera.ejecutar).toHaveBeenCalledTimes(1)
    expect(segunda.ejecutar).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    avanzar(10000)

    expect(segunda.alDeshacer).toHaveBeenCalledTimes(1)
    expect(segunda.ejecutar).not.toHaveBeenCalled()
  })

  test('al cambiar de pantalla (desmontar) ejecuta lo pendiente de inmediato', () => {
    const { unmount } = render(<Prueba />)
    const { ejecutar, alDeshacer } = programar()

    unmount()

    expect(ejecutar).toHaveBeenCalledTimes(1)
    expect(ejecutar).toHaveBeenCalledWith({ alSalir: true })
    expect(alDeshacer).not.toHaveBeenCalled()
    avanzar(10000)
    expect(ejecutar).toHaveBeenCalledTimes(1) // el temporizador ya no la repite
  })

  test('al cerrar la pestaña (pagehide) ejecuta lo pendiente una sola vez, con alSalir', () => {
    const { unmount } = render(<Prueba />)
    const { ejecutar } = programar()

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    avanzar(10000)
    unmount()

    expect(ejecutar).toHaveBeenCalledTimes(1)
    expect(ejecutar).toHaveBeenCalledWith({ alSalir: true })
  })

  test('lo que ya se deshizo no se ejecuta al cambiar de pantalla', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { unmount } = render(<Prueba />)
    const { ejecutar } = programar()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))

    unmount()

    expect(ejecutar).not.toHaveBeenCalled()
  })

  test('una acción que falla no rompe el hook: el aviso se quita y sigue funcionando', async () => {
    render(<Prueba />)
    const falla = jest.fn().mockRejectedValue(new Error('falló'))
    programar({ ejecutar: falla })

    avanzar(6000)
    await act(async () => {})

    expect(falla).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const siguiente = programar({ mensaje: 'Otro aviso' })
    avanzar(6000)
    expect(siguiente.ejecutar).toHaveBeenCalledTimes(1)
  })

  test('la duración se puede cambiar', () => {
    render(<Prueba duracion={1500} />)
    const { ejecutar } = programar()

    expect(document.querySelector('.aviso-barra')).toHaveStyle({ animationDuration: '1500ms' })
    avanzar(1499)
    expect(ejecutar).not.toHaveBeenCalled()
    avanzar(1)
    expect(ejecutar).toHaveBeenCalledTimes(1)
  })

  test('sin acciones pendientes no dibuja avisos', () => {
    render(<Prueba />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
