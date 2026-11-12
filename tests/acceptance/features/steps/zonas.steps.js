const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// ---------- Datos de partida (por la API) ----------

async function crearZonaPorApi(mundo, nombre, tabla) {
  // GeoJSON usa [longitud, latitud] y el anillo se cierra repitiendo el primer punto
  const anillo = tabla.hashes().map((fila) => [Number(fila.longitud), Number(fila.latitud)])
  anillo.push(anillo[0])
  const respuesta = await fetch(`${mundo.api}/api/zonas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, area: { type: 'Polygon', coordinates: [anillo] }, activa: true }),
  })
  const zona = await respuesta.json()
  assert.strictEqual(respuesta.status, 201, `no se pudo crear la zona de partida: ${JSON.stringify(zona)}`)
  return zona
}

// La zona "vecina" o "existente" lleva la etiqueta de la prueba más el rol, para distinguirla de la zona que se dibuja.
Given('que existe la zona {string} con los vértices', async function (rol, tabla) {
  this.zonaExistente = await crearZonaPorApi(this, `${this.zona} ${rol}`, tabla)
})

Given('que existe la zona de la prueba con los vértices', async function (tabla) {
  this.zonaExistente = await crearZonaPorApi(this, this.zona, tabla)
})

// ---------- Pantalla de Zonas ----------

When('escribe el nombre de la zona de la prueba', async function () {
  await this.pagina.locator('#zonaNombre').fill(this.zona)
})

When('ordena la tabla de zonas de mayor a menor número', async function () {
  await this.pagina.getByRole('button', { name: '#' }).click()
})

When('pulsa Editar en la zona de la prueba', async function () {
  await this.pagina.getByRole('button', { name: `Editar zona ${this.zona}` }).click()
})

Then('ve que el punto quedó pegado a un vértice de la zona vecina', async function () {
  await this.pagina.getByText('Punto pegado a un vértice').first().waitFor()
})

Then('ve el aviso de que la zona de la prueba fue {string}', async function (accion) {
  await this.pagina.getByText(`Zona "${this.zona}" ${accion}.`).first().waitFor()
})

Then('ve la zona de la prueba en la tabla de zonas', async function () {
  await this.pagina.getByRole('row', { name: this.zona }).first().waitFor()
})

Then('ve la advertencia de superposición con la zona existente', async function () {
  await this.pagina.getByText('se superpone con').first().waitFor()
  await this.pagina.getByText(`${this.zona} existente`).first().waitFor()
})

Then('no ve ninguna advertencia de superposición', async function () {
  assert.strictEqual(await this.pagina.locator('.mensaje-advertencia').count(), 0)
})

// ---------- Comprobaciones contra el backend ----------

Then('el sistema guardó la zona de la prueba como activa', async function () {
  const zonas = await (await fetch(`${this.api}/api/zonas`)).json()
  const zona = zonas.find((z) => z.nombre === this.zona)
  assert.ok(zona, `la zona ${this.zona} no existe`)
  assert.strictEqual(zona.activa, true)
  this.zonaGuardada = zona
})

Then('el sistema no guardó la zona de la prueba', async function () {
  const zonas = await (await fetch(`${this.api}/api/zonas`)).json()
  assert.strictEqual(zonas.filter((z) => z.nombre === this.zona).length, 0)
})

Then('la zona de la prueba queda con límites entre las longitudes {float} y {float}', async function (minimo, maximo) {
  const zonas = await (await fetch(`${this.api}/api/zonas`)).json()
  const zona = zonas.find((z) => z.nombre === this.zona)
  const longitudes = zona.area.coordinates[0].map((punto) => punto[0])
  assert.ok(Math.abs(Math.min(...longitudes) - minimo) < 0.0005, `longitud mínima ${Math.min(...longitudes)}, se esperaba ${minimo}`)
  assert.ok(Math.abs(Math.max(...longitudes) - maximo) < 0.0005, `longitud máxima ${Math.max(...longitudes)}, se esperaba ${maximo}`)
})

Then('la zona de la prueba comparte el borde con la zona vecina', async function () {
  const zonas = await (await fetch(`${this.api}/api/zonas`)).json()
  const nueva = zonas.find((z) => z.nombre === this.zona)
  const vecina = zonas.find((z) => z.nombre === `${this.zona} vecina`)
  const vertices = (zona) => zona.area.coordinates[0].map((punto) => punto.join(','))
  const comunes = vertices(nueva).filter((vertice) => vertices(vecina).includes(vertice))
  assert.ok(new Set(comunes).size >= 2, 'las zonas deben compartir al menos dos vértices (un borde)')
})
