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
  test('muestra el saludo, la frase del panel, los tres puntos y el pie', () => {
    dibujarLogin()

    expect(screen.getByRole('heading', { level: 1, name: /^(Buenos días|Buenas tardes|Buenas noches)$/ })).toBeInTheDocument()
    expect(screen.getByText('Ingrese con su usuario de personal')).toBeInTheDocument()
    expect(screen.getByText('Organiza tus entregas de última milla en tiempo real')).toBeInTheDocument()
    expect(screen.getByText(/Rutas automáticas/)).toBeInTheDocument()
    expect(screen.getByText(/Seguimiento en vivo/)).toBeInTheDocument()
    expect(screen.getByText(/Zonas dibujadas directamente en el mapa/)).toBeInTheDocument()
    expect(screen.getByText('Sistema de Gestión de Entregas y Rutas · UTA FISEI')).toBeInTheDocument()
  })

  test('la ilustración es decorativa: está oculta a lectores de pantalla', () => {
    const { container } = dibujarLogin()

    expect(container.querySelector('svg.login-ilustracion')).toHaveAttribute('aria-hidden', 'true')
  })

  test('la postal de Ambato tiene volcán con nieve y humo, catedral con cruz, ciudad, árboles y flores', () => {
    const { container } = dibujarLogin()
    const postal = container.querySelector('svg.login-ilustracion')

    expect(postal.querySelector('.login-volcan')).not.toBeNull()
    expect(postal.querySelector('.login-nieve')).not.toBeNull()
    expect(postal.querySelectorAll('.login-humo-bola').length).toBeGreaterThanOrEqual(3)
    expect(postal.querySelector('.login-catedral')).not.toBeNull()
    expect(postal.querySelectorAll('.login-ciudad > g').length).toBeGreaterThanOrEqual(8)
    expect(postal.querySelectorAll('.login-nube')).toHaveLength(3)
  })

  test('tiene la furgoneta en la calle y tres pines de entrega con rebote', () => {
    const { container } = dibujarLogin()
    const postal = container.querySelector('svg.login-ilustracion')

    expect(postal.querySelector('.login-furgoneta')).not.toBeNull()
    expect(postal.querySelectorAll('.login-rueda')).toHaveLength(2)
    expect(postal.querySelectorAll('.login-pin-rebote')).toHaveLength(3)
  })

  test('ya no tiene el mapa visto desde arriba, el río ni los puentes', () => {
    const { container } = dibujarLogin()
    const postal = container.querySelector('svg.login-ilustracion')

    for (const clase of ['login-rio', 'login-puentes', 'login-ruta-trazo', 'login-sector', 'login-manzana']) {
      expect(postal.querySelector(`.${clase}`)).toBeNull()
    }
  })

  test('el fondo de rutas del formulario es decorativo', () => {
    const { container } = dibujarLogin()

    expect(container.querySelector('svg.login-fondo-rutas')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('LoginPage: saludo según la hora', () => {
  afterEach(() => jest.useRealTimers())

  test.each([
    [9, 'Buenos días'],
    [15, 'Buenas tardes'],
    [21, 'Buenas noches'],
  ])('a las %i h el título dice "%s"', (hora, saludo) => {
    jest.useFakeTimers({ now: new Date(2026, 10, 12, hora, 0) })
    dibujarLogin()

    expect(screen.getByRole('heading', { level: 1, name: saludo })).toBeInTheDocument()
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
