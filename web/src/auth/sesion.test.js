import {
  alCambiarSesion,
  cerrarSesion,
  expirarSesion,
  guardarSesion,
  MENSAJE_SESION_EXPIRADA,
  obtenerAvisoSesion,
  obtenerSesion,
  obtenerToken,
  vigilarExpiracion,
} from './sesion'

beforeEach(() => {
  localStorage.clear()
  guardarSesion({ token: 'limpiar', rol: 'STAFF' }) // borra el aviso y el temporizador de la prueba anterior
  cerrarSesion()
})

afterEach(() => jest.useRealTimers())

describe('sesion', () => {
  test('sin sesión no hay token', () => {
    expect(obtenerSesion()).toBeNull()
    expect(obtenerToken()).toBeNull()
  })

  test('guardarSesion conserva token, rol, repartidorId y expiraEn', () => {
    guardarSesion({ token: 'abc', rol: 'STAFF', expiraEn: '2999-01-01T00:00:00Z' })
    expect(obtenerSesion()).toEqual({ token: 'abc', rol: 'STAFF', repartidorId: null, expiraEn: '2999-01-01T00:00:00Z' })
    expect(obtenerToken()).toBe('abc')
  })

  test('sin expiraEn la sesión no vence', () => {
    guardarSesion({ token: 'abc', rol: 'STAFF' })
    expect(obtenerSesion()).toEqual({ token: 'abc', rol: 'STAFF', repartidorId: null, expiraEn: null })
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
    expect(oyente).toHaveBeenLastCalledWith({ token: 'x', rol: 'STAFF', repartidorId: null, expiraEn: null })
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

describe('sesion: expiraEn', () => {
  test('una sesión ya vencida se trata como sin sesión, se borra y deja el aviso', () => {
    localStorage.setItem(
      'logistica.sesion',
      JSON.stringify({ token: 'viejo', rol: 'STAFF', repartidorId: null, expiraEn: '2020-01-01T00:00:00Z' }),
    )

    expect(obtenerToken()).toBeNull()
    expect(localStorage.getItem('logistica.sesion')).toBeNull()
    expect(obtenerAvisoSesion()).toBe(MENSAJE_SESION_EXPIRADA)
  })

  test('cierra la sesión sola cuando llega expiraEn y avisa a los oyentes', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-18T10:00:00Z'))
    const oyente = jest.fn()
    const cancelar = alCambiarSesion(oyente)

    guardarSesion({ token: 'abc', rol: 'STAFF', expiraEn: '2026-11-18T10:00:30Z' })
    jest.advanceTimersByTime(29_000)
    expect(obtenerSesion()).not.toBeNull()
    expect(oyente).toHaveBeenCalledTimes(1) // solo el del login

    jest.advanceTimersByTime(2_000)
    expect(obtenerSesion()).toBeNull()
    expect(oyente).toHaveBeenLastCalledWith(null)
    expect(obtenerAvisoSesion()).toBe(MENSAJE_SESION_EXPIRADA)
    cancelar()
  })

  test('vigilarExpiracion retoma el cierre automático de una sesión guardada antes (recarga de la página)', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-18T10:00:00Z'))
    localStorage.setItem(
      'logistica.sesion',
      JSON.stringify({ token: 'abc', rol: 'STAFF', repartidorId: null, expiraEn: '2026-11-18T10:01:00Z' }),
    )

    vigilarExpiracion()
    jest.advanceTimersByTime(61_000)

    expect(localStorage.getItem('logistica.sesion')).toBeNull()
    expect(obtenerAvisoSesion()).toBe(MENSAJE_SESION_EXPIRADA)
  })

  test('un nuevo login reemplaza el temporizador y borra el aviso', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-18T10:00:00Z'))
    guardarSesion({ token: 'a', rol: 'STAFF', expiraEn: '2026-11-18T10:00:10Z' })
    guardarSesion({ token: 'b', rol: 'STAFF', expiraEn: '2026-11-18T12:00:00Z' })

    jest.advanceTimersByTime(60_000)

    expect(obtenerToken()).toBe('b')
    expect(obtenerAvisoSesion()).toBeNull()
  })

  test('cerrar la sesión a mano no deja aviso', () => {
    guardarSesion({ token: 'abc', rol: 'STAFF', expiraEn: '2999-01-01T00:00:00Z' })
    cerrarSesion()
    expect(obtenerAvisoSesion()).toBeNull()
  })

  test('expirarSesion cierra y deja el aviso; sin sesión no inventa uno', () => {
    expirarSesion()
    expect(obtenerAvisoSesion()).toBeNull()

    guardarSesion({ token: 'abc', rol: 'STAFF' })
    expirarSesion()
    expect(obtenerSesion()).toBeNull()
    expect(obtenerAvisoSesion()).toBe(MENSAJE_SESION_EXPIRADA)
  })
})
