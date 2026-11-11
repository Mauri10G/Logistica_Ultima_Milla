/**
 * Escenarios de poblado. Cada uno fija cuantos pedidos se registran, cuantos repartidores disponibles debe
 * haber y cuantas peticiones van en paralelo. Los parametros --cantidad, --repartidores y --concurrencia
 * pisan el valor del escenario.
 */
const ESCENARIOS = {
  normal: { pedidos: 500, repartidores: 10, concurrencia: 10, descripcion: 'Dia normal de trabajo' },
  alta: { pedidos: 5000, repartidores: 40, concurrencia: 20, descripcion: 'Alta demanda (fecha especial)' },
  'san-valentin': { pedidos: 20000, repartidores: 80, concurrencia: 40, descripcion: 'San Valentin extremo' },
}

function entero(texto, porDefecto, parametro, minimo) {
  if (texto === undefined) return porDefecto
  const numero = Number(texto)
  if (!Number.isInteger(numero) || numero < minimo) {
    throw new Error(`--${parametro} debe ser un entero mayor o igual a ${minimo} (recibido: ${texto})`)
  }
  return numero
}

function resolverOpciones(valores) {
  const escenario = valores.escenario ?? 'alta'
  const base = ESCENARIOS[escenario]
  if (!base) {
    throw new Error(`Escenario desconocido: ${escenario}. Escenarios validos: ${Object.keys(ESCENARIOS).join(', ')}`)
  }
  return {
    escenario,
    cantidad: entero(valores.cantidad, base.pedidos, 'cantidad', 1),
    repartidores: entero(valores.repartidores, base.repartidores, 'repartidores', 0),
    concurrencia: entero(valores.concurrencia, base.concurrencia, 'concurrencia', 1),
  }
}

module.exports = { ESCENARIOS, resolverOpciones }
