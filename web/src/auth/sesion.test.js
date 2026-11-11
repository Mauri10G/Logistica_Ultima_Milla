import { alCambiarSesion, cerrarSesion, guardarSesion, obtenerSesion, obtenerToken } from './sesion'

beforeEach(() => localStorage.clear())

describe('sesion', () => {
  test('sin sesión no hay token', () => {
    expect(obtenerSesion()).toBeNull()
    expect(obtenerToken()).toBeNull()
  })

  test('guardarSesion conserva token, rol y repartidorId', () => {
    guardarSesion({ token: 'abc', rol: 'STAFF' })
    expect(obtenerSesion()).toEqual({ token: 'abc', rol: 'STAFF', repartidorId: null })
    expect(obtenerToken()).toBe('abc')
  })

  test('cerrarSesion borra todo', () => {
    guardarSesion({ token: 'abc', rol: 'COURIER', repartidorId: 4 })
    cerrarSesion()
    expect(obtenerSesion()).toBeNull()
  })

  test('avisa a los oyentes y deja de avisar al cancelar', () => {
    const oyente = jest.fn()
    const cancelar = alCambiarSesion(oyente)

    guardarSesion({ token: 'x', rol: 'STAFF' })
    expect(oyente).toHaveBeenLastCalledWith({ token: 'x', rol: 'STAFF', repartidorId: null })
    cerrarSesion()
    expect(oyente).toHaveBeenLastCalledWith(null)

    cancelar()
    guardarSesion({ token: 'y', rol: 'STAFF' })
    expect(oyente).toHaveBeenCalledTimes(2)
  })

  test('un JSON corrupto se trata como sin sesión', () => {
    localStorage.setItem('logistica.sesion', '{no es json')
    expect(obtenerSesion()).toBeNull()
  })
})
