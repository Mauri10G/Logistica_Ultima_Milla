const { Given, When, Then, Before, After, setDefaultTimeout } = require('@cucumber/cucumber')
const { chromium } = require('playwright')
const assert = require('assert')

setDefaultTimeout(30 * 1000)

const WEB = process.env.WEB_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://localhost:8080'

// Un punto dentro de cada zona de los datos base (latitud, longitud)
const PUNTOS = {
  Centro: [-1.2412, -78.6197],
  Ingahurco: [-1.23, -78.62],
  'Ficoa/Atocha': [-1.225, -78.635],
  'Norte/Izamba': [-1.21, -78.605],
  'Sur/Huachi': [-1.258, -78.62],
}

let navegador
let pagina
let fecha

Before(async function () {
  navegador = await chromium.launch({ headless: process.env.HEADED !== '1' })
  pagina = await navegador.newPage()
})

After(async function () {
  await navegador.close()
})

Given('que existen {int} pedidos pendientes en la zona {string} para una fecha futura', async function (cantidad, zona) {
  // fecha lejana y al azar para no chocar con pedidos de ejecuciones anteriores
  const dias = 200 + Math.floor(Math.random() * 3000)
  fecha = new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const [lat, lng] = PUNTOS[zona]

  for (let i = 0; i < cantidad; i++) {
    const respuesta = await fetch(`${API}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteNombres: `Cliente aceptacion ${i}`,
        clienteTelefono: '0990000000',
        direccion: `Calle ${i}`,
        latitud: lat + i * 0.0003,
        longitud: lng + i * 0.0002,
        fechaEntrega: fecha,
        horaEntrega: '10:00',
      }),
    })
    assert.strictEqual(respuesta.status, 201)
  }
})

When('el personal arma las rutas de esa fecha desde la web', async function () {
  await pagina.goto(`${WEB}/rutas`)
  await pagina.getByLabel('Fecha de entrega').fill(fecha)
  await pagina.getByRole('button', { name: 'Armar rutas' }).click()
  await pagina.getByTestId('ruta-card').first().waitFor()
})

Then('ninguna ruta tiene más de {int} pedidos', async function (maximo) {
  const totales = await pagina.getByTestId('ruta-card').evaluateAll((tarjetas) => tarjetas.map((t) => Number(t.dataset.total)))
  assert.ok(totales.length > 0, 'no se mostró ninguna ruta')
  for (const total of totales) {
    assert.ok(total <= maximo, `una ruta tiene ${total} pedidos y el máximo es ${maximo}`)
  }
})

Then('se crearon {int} rutas', async function (cantidad) {
  assert.strictEqual(await pagina.getByTestId('ruta-card').count(), cantidad)
})
