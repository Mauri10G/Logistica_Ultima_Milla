const test = require('node:test')
const assert = require('node:assert/strict')
const { ESCENARIOS, resolverOpciones } = require('../lib/escenarios')

test('sin parametros usa el escenario de alta demanda', () => {
  assert.deepEqual(resolverOpciones({}), { escenario: 'alta', cantidad: 5000, repartidores: 40, concurrencia: 20 })
})

test('escenario normal: 500 pedidos', () => {
  assert.deepEqual(resolverOpciones({ escenario: 'normal' }), {
    escenario: 'normal',
    cantidad: 500,
    repartidores: 10,
    concurrencia: 10,
  })
})

test('escenario san-valentin: 20000 pedidos', () => {
  assert.deepEqual(resolverOpciones({ escenario: 'san-valentin' }), {
    escenario: 'san-valentin',
    cantidad: 20000,
    repartidores: 80,
    concurrencia: 40,
  })
})

test('los parametros explicitos pisan los valores del escenario', () => {
  const opciones = resolverOpciones({ escenario: 'normal', cantidad: '50', repartidores: '3', concurrencia: '2' })
  assert.deepEqual(opciones, { escenario: 'normal', cantidad: 50, repartidores: 3, concurrencia: 2 })
})

test('--repartidores 0 es valido (no crea repartidores)', () => {
  assert.equal(resolverOpciones({ repartidores: '0' }).repartidores, 0)
})

test('escenario desconocido: error con la lista de escenarios validos', () => {
  assert.throws(() => resolverOpciones({ escenario: 'navidad' }), /Escenario desconocido: navidad.*normal, alta, san-valentin/)
})

test('numeros invalidos: error que nombra el parametro', () => {
  assert.throws(() => resolverOpciones({ cantidad: 'abc' }), /--cantidad/)
  assert.throws(() => resolverOpciones({ cantidad: '0' }), /--cantidad/)
  assert.throws(() => resolverOpciones({ concurrencia: '-5' }), /--concurrencia/)
  assert.throws(() => resolverOpciones({ repartidores: '1.5' }), /--repartidores/)
})

test('los tres escenarios tienen descripcion', () => {
  assert.deepEqual(Object.keys(ESCENARIOS), ['normal', 'alta', 'san-valentin'])
  Object.values(ESCENARIOS).forEach((e) => assert.ok(e.descripcion.length > 0))
})
