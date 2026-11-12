const test = require('node:test')
const assert = require('node:assert/strict')
const { obtenerCabeceras } = require('../lib/auth')
const { iniciarServidor } = require('./servidor-falso')

test('sin API_USUARIO no hace login ni manda token', async () => {
  const servidor = await iniciarServidor(() => ({ estado: 500, cuerpo: null }))
  try {
    const cabeceras = await obtenerCabeceras(servidor.url, {})
    assert.deepEqual(cabeceras, { 'Content-Type': 'application/json' })
    assert.equal(servidor.peticiones.length, 0)
  } finally {
    await servidor.cerrar()
  }
})

test('con API_USUARIO hace login y devuelve el token Bearer', async () => {
  const servidor = await iniciarServidor(() => ({
    estado: 200,
    cuerpo: { token: 'abc.def.ghi', rol: 'STAFF', repartidorId: null },
  }))
  try {
    const cabeceras = await obtenerCabeceras(servidor.url, { API_USUARIO: 'staff', API_CLAVE: 'staff123' })
    assert.equal(cabeceras.Authorization, 'Bearer abc.def.ghi')
    assert.equal(cabeceras['Content-Type'], 'application/json')
    assert.equal(servidor.peticiones.length, 1)
    assert.equal(servidor.peticiones[0].metodo, 'POST')
    assert.equal(servidor.peticiones[0].ruta, '/api/auth/login')
    assert.deepEqual(servidor.peticiones[0].cuerpo, { usuario: 'staff', clave: 'staff123' })
  } finally {
    await servidor.cerrar()
  }
})

test('credenciales rechazadas: error con el usuario y el codigo HTTP', async () => {
  const servidor = await iniciarServidor(() => ({ estado: 401, cuerpo: { mensaje: 'Credenciales invalidas' } }))
  try {
    await assert.rejects(
      obtenerCabeceras(servidor.url, { API_USUARIO: 'staff', API_CLAVE: 'mala' }),
      /Login fallido para staff: HTTP 401/,
    )
  } finally {
    await servidor.cerrar()
  }
})

test('respuesta sin token: error', async () => {
  const servidor = await iniciarServidor(() => ({ estado: 200, cuerpo: { rol: 'STAFF' } }))
  try {
    await assert.rejects(obtenerCabeceras(servidor.url, { API_USUARIO: 'staff' }), /no devolvio un token/)
  } finally {
    await servidor.cerrar()
  }
})
