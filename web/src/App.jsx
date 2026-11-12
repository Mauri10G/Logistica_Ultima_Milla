import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RutaProtegida from './components/RutaProtegida'
import InicioPage from './pages/InicioPage'
import LoginPage from './pages/LoginPage'
import PedidosPage from './pages/PedidosPage'
import RepartidoresPage from './pages/RepartidoresPage'
import RutasPage from './pages/RutasPage'
import SeguimientoPage from './pages/SeguimientoPage'
import ZonasPage from './pages/ZonasPage'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="zonas" element={<ZonasPage />} />
          <Route path="rutas" element={<RutasPage />} />
          <Route path="repartidores" element={<RepartidoresPage />} />
          <Route path="seguimiento" element={<SeguimientoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
