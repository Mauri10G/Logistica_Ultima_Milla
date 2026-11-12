const test = require('node:test')
const assert = require('node:assert/strict')
const { repartidorDePrueba, asegurarRepartidores } = require('../lib/repartidores')
const { iniciarServidor } = require('./servidor-falso')

const CABECERAS = { 'Content-Type': 'application/json', Authorization: 'Bearer token-de-prueba' }

/** API falsa de repartidores que arranca con `iniciales` y guarda las altas. */
function apiDeRepartidores(iniciales) {
  const lista = [...iniciales]
  return iniciarServidor((peticion) => {
    if (peticion.metodo === 'GET' && peticion.ruta === '/api/repartidores') return { estado: 200, cuerpo: lista }
    if (peticion.metodo === 'POST' && peticion.ruta === '/api/repartidores') {
      const creado = { id: lista.length + 1, activo: true, ...peticion.cuerpo }
      lista.push(creado)
      return { estado: 201, cuerpo: creado }
    }
    return { estado: 404, cuerpo: null }
  })
}

const existente = (id, disponible = true) => ({
  id,
  nombres: `Base ${id}`,
  telefono: '0991000000',
  disponible,
  capacidadMaxima: 4,
  activo: true,
})

test('repartidorDePrueba cumple el contrato de la API y es determinista', () => {
  const uno = repartidorDePrueba(7)
  assert.deepEqual(uno, repartidorDePrueba(7))
  assert.match(uno.nombres, /\(R007\)$/)
  assert.match(uno.telefono, /^09\d{8}$/)
  assert.equal(uno.capacidadMaxima, 4)
  assert.equal(uno.disponible, true)
  assert.notEqual(repartidorDePrueba(8).telefono, uno.telefono)
})

test('crea solo los que faltan para llegar al total', async () => {
  const servidor = await apiDeRepartidores([existente(1), existente(2), existente(3)])
  try {
    const resultado = await asegurarRepartidores(servidor.url, 5, CABECERAS)
    assert.deepEqual(resultado, { existentes: 3, creados: 2 })
    const altas = servidor.peticiones.filter((p) => p.metodo === 'POST')
    assert.equal(altas.length, 2)
    assert.deepEqual(altas[0].cuerpo, repartidorDePrueba(4))
    assert.deepEqual(altas[1].cuerpo, repartidorDePrueba(5))
  } finally {
    await servidor.cerrar()
  }
})

test('si ya hay suficientes no crea ninguno (se puede ejecutar dos veces)', async () => {
  const servidor = await apiDeRepartidores([existente(1), existente(2), existente(3)])
  try {
    assert.deepEqual(await asegurarRepartidores(servidor.url, 3, CABECERAS), { existentes: 3, creados: 0 })
    assert.deepEqual(await asegurarRepartidores(servidor.url, 2, CABECERAS), { existentes: 3, creados: 0 })
    assert.equal(servidor.peticiones.filter((p) => p.metodo === 'POST').length, 0)
  } finally {
    await servidor.cerrar()
  }
})

test('los no disponibles no cuentan', async () => {
  const servidor = await apiDeRepartidores([existente(1), existente(2, false)])
  try {
    assert.deepEqual(await asegurarRepartidores(servidor.url, 3, CABECERAS), { existentes: 1, creados: 2 })
  } finally {
    await servidor.cerrar()
  }
})

test('manda las cabeceras recibidas (token) en cada llamada', async () => {
  const servidor = await apiDeRepartidores([])
  try {
    await asegurarRepartidores(servidor.url, 1, CABECERAS)
    assert.equal(servidor.peticiones.length, 2)
    servidor.peticiones.forEach((p) => assert.equal(p.cabeceras.authorization, 'Bearer token-de-prueba'))
  } finally {
    await servidor.cerrar()
  }
})

test('si el alta falla, error con el codigo HTTP', async () => {
  const servidor = await iniciarServidor((peticion) =>
    peticion.metodo === 'GET' ? { estado: 200, cuerpo: [] } : { estado: 400, cuerpo: { mensaje: 'Datos invalidos' } },
  )
  try {
    await assert.rejects(asegurarRepartidores(servidor.url, 1, CABECERAS), /No se pudo crear el repartidor.*HTTP 400/)
  } finally {
    await servidor.cerrar()
  }
})
