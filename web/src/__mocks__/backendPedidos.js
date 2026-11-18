import { normalizar } from '../utils/busqueda'
import { ESTADOS_PEDIDO } from '../utils/estados'

// Valor por el que ordena cada columna de `sort` (las mismas que acepta GET /api/pedidos).
const COLUMNAS = {
  id: (pedido) => pedido.id,
  cliente: (pedido) => normalizar(pedido.clienteNombres),
  direccion: (pedido) => normalizar(pedido.direccion),
  zona: (pedido) => normalizar(pedido.zonaNombre),
  fechaEntrega: (pedido) => `${pedido.fechaEntrega ?? ''} ${pedido.horaEntrega ?? ''}`,
  fechaRegistro: (pedido) => pedido.fechaRegistro ?? '',
  estado: (pedido) => ESTADOS_PEDIDO.indexOf(pedido.estado), // por el flujo del pedido, no alfabético
}

/**
 * Simula `GET /api/pedidos` para las pruebas de las pantallas: filtra por `estado`, busca `q` en cliente y dirección
 * (sin mayúsculas ni tildes), ordena con `sort` ("cliente,desc"; sin él, por id) y devuelve la página `page` de tamaño
 * `size` junto con el total de todas las páginas. Los filtros de fecha y zona no se simulan.
 */
export function consultarPedidos(pedidos, { estado, q, sort, page = 0, size = 100 } = {}) {
  const buscado = normalizar(q)
  let filtrados = pedidos.filter((pedido) => !estado || pedido.estado === estado)
  if (buscado) {
    filtrados = filtrados.filter((pedido) =>
      [pedido.clienteNombres, pedido.direccion].some((campo) => normalizar(campo).includes(buscado)),
    )
  }
  const [columna, direccion = 'asc'] = (sort ?? 'id,asc').split(',')
  const signo = direccion === 'desc' ? -1 : 1
  const valor = COLUMNAS[columna]
  const ordenados = [...filtrados].sort((a, b) => {
    const x = valor(a)
    const y = valor(b)
    if (x === y) return a.id - b.id // desempate por id, como el backend
    return signo * (x < y ? -1 : 1)
  })
  return { pedidos: ordenados.slice(page * size, (page + 1) * size), total: ordenados.length }
}
