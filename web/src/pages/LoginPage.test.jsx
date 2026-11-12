import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { iniciarSesionApi } from '../api/authApi'
import { obtenerSesion } from '../auth/sesion'
import LoginPage from './LoginPage'

// El login se prueba encendido; la lógica de sesión y redirecciones está en auth/acceso.test.jsx.
jest.mock('../entorno', () => ({ API_URL: 'http://localhost:8080', AUTH_HABILITADA: true }))
jest.mock('../api/authApi', () => ({ iniciarSesionApi: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

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

describe('LoginPage (diseño)', () => {
  test('muestra la bienvenida, la frase del panel, los tres puntos y el pie', () => {
    dibujarLogin()

    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenido' })).toBeInTheDocument()
    expect(screen.getByText('Ingrese con su usuario de personal')).toBeInTheDocument()
    expect(screen.getByText('Organiza tus entregas de última milla en tiempo real')).toBeInTheDocument()
    expect(screen.getByText(/Rutas automáticas/)).toBeInTheDocument()
    expect(screen.getByText(/Seguimiento en vivo/)).toBeInTheDocument()
    expect(screen.getByText(/Zonas dibujadas directamente en el mapa/)).toBeInTheDocument()
    expect(screen.getByText('Sistema de Gestión de Entregas y Rutas · UTA FISEI')).toBeInTheDocument()
  })

  test('la ilustración del mapa es decorativa: está oculta a lectores de pantalla', () => {
    const { container } = dibujarLogin()

    const ilustracion = container.querySelector('svg.login-ilustracion')
    expect(ilustracion).toHaveAttribute('aria-hidden', 'true')
    // 4 pines de entrega, una ruta y la furgoneta
    expect(ilustracion.querySelectorAll('.login-pin')).toHaveLength(4)
    expect(ilustracion.querySelector('.login-ruta-trazo')).not.toBeNull()
    expect(ilustracion.querySelector('.login-furgoneta')).not.toBeNull()
  })
})

describe('LoginPage: mostrar u ocultar la clave', () => {
  test('la clave empieza oculta y el botón la muestra y la vuelve a ocultar', async () => {
    const user = userEvent.setup()
    dibujarLogin()
    const clave = screen.getByLabelText('Clave')
    await user.type(clave, 'secreta')

    expect(clave).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar clave' }))
    expect(clave).toHaveAttribute('type', 'text')
    expect(clave).toHaveValue('secreta')
    expect(screen.queryByRole('button', { name: 'Mostrar clave' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ocultar clave' }))
    expect(clave).toHaveAttribute('type', 'password')
    expect(clave).toHaveValue('secreta')
  })

  test('el botón del ojo no envía el formulario y apunta al campo de la clave', async () => {
    const user = userEvent.setup()
    dibujarLogin()

    const ojo = screen.getByRole('button', { name: 'Mostrar clave' })
    expect(ojo).toHaveAttribute('type', 'button')
    expect(ojo).toHaveAttribute('aria-controls', 'loginClave')

    await user.click(ojo)

    expect(iniciarSesionApi).not.toHaveBeenCalled()
  })
})

describe('LoginPage: estado de carga', () => {
  test('mientras envía, el botón queda deshabilitado, ocupado y dice Ingresando…', async () => {
    const user = userEvent.setup()
    let resolver
    iniciarSesionApi.mockReturnValue(new Promise((resolve) => (resolver = resolve)))
    dibujarLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Clave'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const boton = await screen.findByRole('button', { name: 'Ingresando…' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Ingresar' })).not.toBeInTheDocument()

    await act(async () => resolver({ token: 'tok', rol: 'STAFF', repartidorId: null }))

    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument()
    expect(obtenerSesion()).toEqual({ token: 'tok', rol: 'STAFF', repartidorId: null })
  })

  test('si falla, el botón vuelve a Ingresar y se puede reintentar', async () => {
    const user = userEvent.setup()
    iniciarSesionApi.mockRejectedValue({ response: { status: 401, data: {} } })
    dibujarLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Clave'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o clave incorrectos')
    const boton = screen.getByRole('button', { name: 'Ingresar' })
    expect(boton).toBeEnabled()
    expect(boton).toHaveAttribute('aria-busy', 'false')
  })
})
