import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { iniciarSesionApi } from '../api/authApi'
import Layout from '../components/Layout'
import RutaProtegida from '../components/RutaProtegida'
import LoginPage from '../pages/LoginPage'
import { cerrarSesion, expirarSesion, guardarSesion, obtenerSesion } from './sesion'
import { useSesion } from './useSesion'

let mockAuthHabilitada = true

jest.mock('../entorno', () => ({
  API_URL: 'http://localhost:8080',
  get AUTH_HABILITADA() {
    return mockAuthHabilitada
  },
}))
jest.mock('../api/authApi', () => ({ iniciarSesionApi: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockAuthHabilitada = true
})

function errorHttp(status, datos = {}) {
  return { response: { status, data: datos } }
}

function dibujarLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Pantalla de inicio</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function dibujarProtegida(ruta = '/privada') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route element={<RutaProtegida />}>
          <Route path="/privada" element={<p>Contenido privado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  test('los campos tienen label asociado', () => {
    dibujarLogin()

    expect(screen.getByLabelText('Usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Clave')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  test('un login correcto guarda token y rol y entra a la aplicación', async () => {
    const user = userEvent.setup()
    iniciarSesionApi.mockResolvedValue({ token: 'tok', rol: 'STAFF', repartidorId: null, expiraEn: '2999-01-01T00:00:00Z' })
    dibujarLogin()

    await user.type(screen.getByLabelText('Usuario'), '  admin ')
    await user.type(screen.getByLabelText('Clave'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(iniciarSesionApi).toHaveBeenCalledWith('admin', 'secreta')
    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument()
    expect(obtenerSesion()).toEqual({ token: 'tok', rol: 'STAFF', repartidorId: null, expiraEn: '2999-01-01T00:00:00Z', usuario: 'admin' })
  })

  test('credenciales incorrectas (401) muestran un mensaje claro y no guardan sesión', async () => {
    const user = userEvent.setup()
    iniciarSesionApi.mockRejectedValue(errorHttp(401, { mensaje: 'Credenciales invalidas' }))
    dibujarLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Clave'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o clave incorrectos')
    expect(obtenerSesion()).toBeNull()
  })

  test('con error los campos quedan marcados como inválidos y apuntan al mensaje', async () => {
    const user = userEvent.setup()
    iniciarSesionApi.mockRejectedValue(errorHttp(401, { mensaje: 'Credenciales invalidas' }))
    dibujarLogin()

    expect(screen.getByLabelText('Usuario')).toHaveAttribute('aria-invalid', 'false')
    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Clave'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const alerta = await screen.findByRole('alert')
    for (const campo of ['Usuario', 'Clave']) {
      expect(screen.getByLabelText(campo)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(campo)).toHaveAttribute('aria-describedby', alerta.id)
    }
  })

  test('otro error del servidor muestra su mensaje', async () => {
    const user = userEvent.setup()
    iniciarSesionApi.mockRejectedValue(errorHttp(500, { mensaje: 'Ocurrio un error interno' }))
    dibujarLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Clave'), 'x')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('no envía si faltan usuario o clave', async () => {
    const user = userEvent.setup()
    dibujarLogin()

    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(iniciarSesionApi).not.toHaveBeenCalled()
  })

  test('con el login deshabilitado redirige a la aplicación', () => {
    mockAuthHabilitada = false
    dibujarLogin()

    expect(screen.getByText('Pantalla de inicio')).toBeInTheDocument()
  })

  test('con una sesión de personal ya iniciada redirige a la aplicación', () => {
    guardarSesion({ token: 't', rol: 'STAFF' })
    dibujarLogin()

    expect(screen.getByText('Pantalla de inicio')).toBeInTheDocument()
  })
})

describe('RutaProtegida', () => {
  test('con el login deshabilitado deja pasar sin sesión', () => {
    mockAuthHabilitada = false
    dibujarProtegida()

    expect(screen.getByText('Contenido privado')).toBeInTheDocument()
  })

  test('con login habilitado y sin sesión va al login', () => {
    dibujarProtegida()

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  test('el personal (STAFF) accede', () => {
    guardarSesion({ token: 't', rol: 'STAFF' })
    dibujarProtegida()

    expect(screen.getByText('Contenido privado')).toBeInTheDocument()
  })

  test('un repartidor (COURIER) ve que no tiene acceso a la web y puede cerrar sesión', async () => {
    const user = userEvent.setup()
    guardarSesion({ token: 't', rol: 'COURIER', repartidorId: 3 })
    dibujarProtegida()

    expect(screen.getByRole('alert')).toHaveTextContent('no tiene acceso a la aplicación web')
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(obtenerSesion()).toBeNull()
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })

  describe('pantalla Sin acceso', () => {
    test('tiene el estilo del login: dos columnas con la ilustración a la izquierda y el candado, el título y el aviso a la derecha', () => {
      guardarSesion({ token: 't', rol: 'COURIER', repartidorId: 3 })
      const { container } = dibujarProtegida()

      expect(container.querySelector('main.login-pagina')).not.toBeNull()
      const izquierda = container.querySelector('.login-panel')
      expect(izquierda.querySelector('svg.login-ilustracion')).not.toBeNull()
      const derecha = container.querySelector('.login-lado-form')
      expect(derecha.querySelector('.sin-acceso-candado svg')).not.toBeNull()
      expect(within(derecha).getByRole('heading', { name: 'Sin acceso' })).toBeInTheDocument()
      expect(derecha).toHaveTextContent('Su usuario no tiene acceso a la aplicación web. Los repartidores deben usar la aplicación móvil.')
      expect(within(derecha).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    })

    test('muestra el nombre del usuario que ingresó', () => {
      guardarSesion({ token: 't', rol: 'COURIER', repartidorId: 3, usuario: 'carlos' })
      dibujarProtegida()

      expect(screen.getByText('carlos')).toBeInTheDocument()
      expect(screen.getByText(/Sesión iniciada como/)).toBeInTheDocument()
    })

    test('si la sesión no guardó el nombre (sesión anterior), lo toma del token', () => {
      const cuerpo = btoa(JSON.stringify({ sub: 'luis', rol: 'COURIER' })).replaceAll('=', '')
      localStorage.setItem('logistica.sesion', JSON.stringify({ token: `a.${cuerpo}.c`, rol: 'COURIER', repartidorId: 2 }))
      dibujarProtegida()

      expect(screen.getByText('luis')).toBeInTheDocument()
    })

    test('sin nombre en la sesión ni en el token no muestra la línea del usuario', () => {
      guardarSesion({ token: 't', rol: 'COURIER', repartidorId: 3 })
      dibujarProtegida()

      expect(screen.queryByText(/Sesión iniciada como/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    })
  })

  test('si la sesión se invalida (401) vuelve al login', () => {
    guardarSesion({ token: 't', rol: 'STAFF' })
    dibujarProtegida()
    expect(screen.getByText('Contenido privado')).toBeInTheDocument()

    act(() => cerrarSesion())

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })

  test('al vencer expiraEn la sesión se cierra sola y la pantalla vuelve al login', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-18T10:00:00Z'))
    guardarSesion({ token: 't', rol: 'STAFF', expiraEn: '2026-11-18T10:00:30Z' })
    dibujarProtegida()
    expect(screen.getByText('Contenido privado')).toBeInTheDocument()

    act(() => jest.advanceTimersByTime(31_000))

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(obtenerSesion()).toBeNull()
    jest.useRealTimers()
  })

  test('un token ya vencido al abrir la página va al login', () => {
    localStorage.setItem('logistica.sesion', JSON.stringify({ token: 'viejo', rol: 'STAFF', repartidorId: null, expiraEn: '2020-01-01T00:00:00Z' }))
    dibujarProtegida()

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })

  test('una sesión que el backend rechaza (401 NO_AUTENTICADO) vuelve al login', () => {
    guardarSesion({ token: 't', rol: 'STAFF' })
    dibujarProtegida()

    act(() => expirarSesion())

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })
})

describe('useSesion', () => {
  function Estado() {
    const { sesion } = useSesion()
    return <p>{sesion ? `rol ${sesion.rol}` : 'sin sesión'}</p>
  }

  test('entrega la sesión actual y se actualiza al iniciar y cerrar sesión', () => {
    render(<Estado />)
    expect(screen.getByText('sin sesión')).toBeInTheDocument()

    act(() => guardarSesion({ token: 't', rol: 'COURIER', repartidorId: 1 }))
    expect(screen.getByText('rol COURIER')).toBeInTheDocument()

    act(() => cerrarSesion())
    expect(screen.getByText('sin sesión')).toBeInTheDocument()
  })
})

describe('Layout', () => {
  function dibujarLayout() {
    return render(
      <MemoryRouter initialEntries={['/pedidos']}>
        <Routes>
          <Route path="/login" element={<p>Pantalla de login</p>} />
          <Route element={<RutaProtegida />}>
            <Route element={<Layout />}>
              <Route path="/pedidos" element={<p>Contenido de pedidos</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  test('muestra el menú con las seis secciones', () => {
    mockAuthHabilitada = false
    dibujarLayout()

    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    for (const texto of ['Inicio', 'Pedidos', 'Zonas', 'Rutas', 'Repartidores', 'Seguimiento']) {
      expect(menu).toHaveTextContent(texto)
    }
    expect(screen.getByText('Contenido de pedidos')).toBeInTheDocument()
  })

  test('sin login no hay botón Cerrar sesión', () => {
    mockAuthHabilitada = false
    dibujarLayout()

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  test('con sesión, Cerrar sesión la borra y vuelve al login', async () => {
    const user = userEvent.setup()
    guardarSesion({ token: 't', rol: 'STAFF' })
    dibujarLayout()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(obtenerSesion()).toBeNull()
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })
})
