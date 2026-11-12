const CANTIDAD_PROXIMAS = 5

/** Porcentaje (entero) de pedidos ENTREGADO; 0 si no hay pedidos. */
export function porcentajeEntregado(pedidos) {
  if (pedidos.length === 0) return 0
  return Math.round((pedidos.filter((pedido) => pedido.estado === 'ENTREGADO').length / pedidos.length) * 100)
}

/** Los pedidos que faltan por entregar, ordenados por hora de entrega; los que no tienen hora van al final. */
export function proximasEntregas(pedidos, cantidad = CANTIDAD_PROXIMAS) {
  return pedidos
    .filter((pedido) => pedido.estado !== 'ENTREGADO')
    .sort((a, b) => {
      if (!a.horaEntrega && !b.horaEntrega) return 0
      if (!a.horaEntrega) return 1
      if (!b.horaEntrega) return -1
      return a.horaEntrega.localeCompare(b.horaEntrega)
    })
    .slice(0, cantidad)
}
