import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

jest.mock('./pages/PedidosPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('p', null, 'Página de pedidos'),
}))
jest.mock('./pages/ZonasPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('p', null, 'Página de zonas'),
}))
jest.mock('./pages/RutasPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('p', null, 'Página de rutas'),
}))
jest.mock('./pages/RepartidoresPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('p', null, 'Página de repartidores'),
}))
jest.mock('./pages/SeguimientoPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('p', null, 'Página de seguimiento'),
}))

function dibujar(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  test.each([
    ['/pedidos', 'Página de pedidos'],
    ['/zonas', 'Página de zonas'],
    ['/rutas', 'Página de rutas'],
    ['/repartidores', 'Página de repartidores'],
    ['/seguimiento', 'Página de seguimiento'],
  ])('la ruta %s muestra su pantalla', (ruta, texto) => {
    dibujar(ruta)
    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  test('la raíz y las rutas desconocidas van a pedidos', () => {
    dibujar('/')
    expect(screen.getByText('Página de pedidos')).toBeInTheDocument()
  })

  test('una ruta desconocida va a pedidos', () => {
    dibujar('/no-existe')
    expect(screen.getByText('Página de pedidos')).toBeInTheDocument()
  })

  test('sin login habilitado /login redirige a la aplicación', () => {
    dibujar('/login')
    expect(screen.getByText('Página de pedidos')).toBeInTheDocument()
  })
})
