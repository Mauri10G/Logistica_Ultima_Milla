/** Indica si el WebSocket (tiempo real) está conectado o desconectado. */
export default function IndicadorConexion({ conectado }) {
  return (
    <output className={conectado ? 'conexion conexion-ok' : 'conexion conexion-error'}>
      Tiempo real: {conectado ? 'conectado' : 'desconectado'}
    </output>
  )
}
