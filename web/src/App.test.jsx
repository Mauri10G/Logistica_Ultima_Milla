import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

jest.mock('./pages/InicioPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('p', null, 'Página de inicio'),
}))
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
    ['/', 'Página de inicio'],
    ['/pedidos', 'Página de pedidos'],
    ['/zonas', 'Página de zonas'],
    ['/rutas', 'Página de rutas'],
    ['/repartidores', 'Página de repartidores'],
    ['/seguimiento', 'Página de seguimiento'],
  ])('la ruta %s muestra su pantalla', (ruta, texto) => {
    dibujar(ruta)
    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  test('una ruta desconocida va al inicio', () => {
    dibujar('/no-existe')
    expect(screen.getByText('Página de inicio')).toBeInTheDocument()
  })

  test('sin login habilitado /login redirige a la aplicación', () => {
    dibujar('/login')
    expect(screen.getByText('Página de inicio')).toBeInTheDocument()
  })
})
