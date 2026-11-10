const ETIQUETAS = {
  PENDIENTE: 'Pendiente',
  ASIGNADO: 'Asignado',
  RECOGIDO: 'Recogido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  ARMADA: 'Armada',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
}

export default function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{ETIQUETAS[estado] ?? estado}</span>
}
