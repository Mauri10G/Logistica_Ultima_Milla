const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

const PANTALLAS = {
  Inicio: '/',
  Pedidos: '/pedidos',
  Zonas: '/zonas',
  Rutas: '/rutas',
  Repartidores: '/repartidores',
  Seguimiento: '/seguimiento',
}

Given('que el personal abre la pantalla de {string}', async function (pantalla) {
  await this.pagina.goto(`${this.web}${PANTALLAS[pantalla]}`)
  await this.pagina.getByRole('heading', { name: pantalla, level: 1 }).waitFor()
})

When('pulsa el botón {string}', async function (boton) {
  await this.pagina.getByRole('button', { name: boton, exact: true }).click()
})

// El mapa abre centrado en Ambato (-1.2491, -78.6167) con zoom 13; con eso se pasa de latitud/longitud a un
// punto del mapa (Web Mercator: 256 * 2^13 píxeles dan la vuelta al mundo).
When('hace clic en el mapa en la latitud {float} y longitud {float}', async function (latitud, longitud) {
  const mapa = this.pagina.locator('.leaflet-container').first()
  if (!this.mapaListo) {
    // antes del primer clic: el mapa visible y las zonas existentes ya dibujadas (un <path> por zona activa).
    // La zona de la prueba no cuenta: al editarla (CP-07) su polígono se borra con "Limpiar" antes de dibujar el nuevo.
    await mapa.waitFor()
    const zonas = await (await fetch(`${this.api}/api/zonas?soloActivas=true`)).json()
    const dibujadas = zonas.filter((zona) => zona.nombre !== this.zona).length
    if (dibujadas > 0) await this.pagina.locator('.leaflet-overlay-pane path').nth(dibujadas - 1).waitFor()
    this.mapaListo = true
  }
  // hover primero: lleva el mapa a la vista; si la página se desplaza durante el clic, el punto cae en otro lugar
  await mapa.hover()
  const caja = await mapa.boundingBox()
  const mundo = 256 * 2 ** 13
  const mercatorY = (grados) => (Math.log(Math.tan(Math.PI / 4 + (grados * Math.PI) / 360)) * mundo) / (2 * Math.PI)
  const dx = ((longitud - -78.6167) * mundo) / 360
  const dy = mercatorY(-1.2491) - mercatorY(latitud)
  await mapa.click({ position: { x: caja.width / 2 + dx, y: caja.height / 2 + dy } })
})

Then('ve el aviso {string}', async function (texto) {
  await this.pagina.getByText(texto).first().waitFor()
})

Then('ve el mensaje de error {string}', async function (texto) {
  await this.pagina.getByText(texto).first().waitFor()
})

Then('no ve el mensaje de error {string}', async function (texto) {
  assert.strictEqual(await this.pagina.getByText(texto).count(), 0)
})
