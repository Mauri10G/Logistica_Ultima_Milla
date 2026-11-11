/** Indica si el WebSocket (tiempo real) está conectado o desconectado. */
export default function IndicadorConexion({ conectado }) {
  return (
    <span className={conectado ? 'conexion conexion-ok' : 'conexion conexion-error'} role="status">
      Tiempo real: {conectado ? 'conectado' : 'desconectado'}
    </span>
  )
}
