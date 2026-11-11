import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { iniciarSesionApi } from '../api/authApi'
import Layout from '../components/Layout'
import RutaProtegida from '../components/RutaProtegida'
import LoginPage from '../pages/LoginPage'
import { cerrarSesion, guardarSesion, obtenerSesion } from './sesion'

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
    iniciarSesionApi.mockResolvedValue({ token: 'tok', rol: 'STAFF', repartidorId: null })
    dibujarLogin()

    await user.type(screen.getByLabelText('Usuario'), '  admin ')
    await user.type(screen.getByLabelText('Clave'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(iniciarSesionApi).toHaveBeenCalledWith('admin', 'secreta')
    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument()
    expect(obtenerSesion()).toEqual({ token: 'tok', rol: 'STAFF', repartidorId: null })
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

  test('si la sesión se invalida (401) vuelve al login', () => {
    guardarSesion({ token: 't', rol: 'STAFF' })
    dibujarProtegida()
    expect(screen.getByText('Contenido privado')).toBeInTheDocument()

    act(() => cerrarSesion())

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
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

  test('muestra el menú con las cinco secciones', () => {
    mockAuthHabilitada = false
    dibujarLayout()

    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    for (const texto of ['Pedidos', 'Zonas', 'Rutas', 'Repartidores', 'Seguimiento']) {
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
