const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// Un punto dentro de cada zona de los datos base (latitud, longitud)
const PUNTOS = {
  Centro: [-1.2412, -78.6197],
  Ingahurco: [-1.23, -78.62],
  'Ficoa/Atocha': [-1.225, -78.635],
  'Norte/Izamba': [-1.21, -78.605],
  'Sur/Huachi': [-1.258, -78.62],
}

// ---------- Datos de partida (por la API) ----------

Given('que existen {int} pedidos pendientes en la zona {string} para una fecha futura', async function (cantidad, zona) {
  const [latitud, longitud] = PUNTOS[zona]
  for (let i = 0; i < cantidad; i++) {
    const respuesta = await fetch(`${this.api}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteNombres: `${this.cliente} ${i}`,
        clienteTelefono: '0990000000',
        direccion: `Calle ${i} ${this.etiqueta}`,
        latitud: latitud + i * 0.0003,
        longitud: longitud + i * 0.0002,
        fechaEntrega: this.fechaLejana,
        horaEntrega: '10:00',
      }),
    })
    assert.strictEqual(respuesta.status, 201)
  }
})

Given('que las rutas de esa fecha ya están armadas', async function () {
  const respuesta = await fetch(`${this.api}/api/rutas/armar?fecha=${this.fechaLejana}`, { method: 'POST' })
  assert.strictEqual(respuesta.status, 200)
  this.rutas = await respuesta.json()
})

// ---------- Pantalla de Rutas ----------

When('el personal pide armar las rutas de esa fecha desde la web', async function () {
  await this.pagina.goto(`${this.web}/rutas`)
  await this.pagina.locator('#rutasFecha').fill(this.fechaLejana)
  // se espera a que desaparezcan las rutas de la fecha anterior (mañana) para no contar tarjetas que no son de esta prueba
  await this.pagina.getByText('No hay rutas armadas para esta fecha.').waitFor()
  await this.pagina.getByRole('button', { name: 'Armar rutas' }).click()
})

Then('ve el diálogo de confirmación con {int} pedidos pendientes para armar', async function (cantidad) {
  const dialogo = this.pagina.getByRole('alertdialog')
  await dialogo.waitFor()
  await dialogo.getByText(`${cantidad} pedido(s) pendiente(s)`).waitFor()
  await dialogo.getByText(this.fechaLejana.split('-').reverse().join('/'), { exact: true }).waitFor()
})

Then('ve las rutas armadas', async function () {
  await this.pagina.locator('[data-testid="ruta-card"]').first().waitFor()
})

Then('ninguna ruta tiene más de {int} pedidos', async function (maximo) {
  const tarjetas = this.pagina.locator('[data-testid="ruta-card"]')
  const cantidad = await tarjetas.count()
  assert.ok(cantidad > 0, 'no se mostró ninguna ruta')
  for (let i = 0; i < cantidad; i++) {
    const total = Number(await tarjetas.nth(i).getAttribute('data-total'))
    assert.ok(total <= maximo, `una ruta tiene ${total} pedidos y el máximo es ${maximo}`)
  }
})

Then('se crearon {int} rutas', async function (cantidad) {
  assert.strictEqual(await this.pagina.locator('[data-testid="ruta-card"]').count(), cantidad)
})

Then('los {int} pedidos quedaron repartidos entre las rutas', async function (cantidad) {
  const tarjetas = this.pagina.locator('[data-testid="ruta-card"]')
  let suma = 0
  for (let i = 0; i < (await tarjetas.count()); i++) {
    suma += Number(await tarjetas.nth(i).getAttribute('data-total'))
  }
  assert.strictEqual(suma, cantidad)
})

Then('el sistema asignó los {int} pedidos y cada uno está en una sola ruta', async function (cantidad) {
  const pedidos = await (await fetch(`${this.api}/api/pedidos?fecha=${this.fechaLejana}&size=1000`)).json()
  assert.strictEqual(pedidos.length, cantidad)
  for (const pedido of pedidos) {
    assert.strictEqual(pedido.estado, 'ASIGNADO', `el pedido ${pedido.id} está ${pedido.estado}`)
    assert.ok(pedido.rutaId, `el pedido ${pedido.id} no tiene ruta`)
  }
})

// ---------- Ajustes manuales (@pendiente: esperan los endpoints de Joseph) ----------

Given('que el personal abre la pantalla de Rutas con las rutas de esa fecha', async function () {
  await this.pagina.goto(`${this.web}/rutas`)
  await this.pagina.locator('#rutasFecha').fill(this.fechaLejana)
  await this.pagina.locator('[data-testid="ruta-card"]').first().waitFor()
})

When('pulsa Ajustar ruta en la primera ruta', async function () {
  await this.pagina.getByRole('button', { name: 'Ajustar ruta' }).first().click()
})

When('baja la parada del primer pedido de la primera ruta', async function () {
  this.ordenAntes = this.rutas[0].pedidos.map((pedido) => pedido.id)
  await this.pagina.getByRole('button', { name: `Bajar la parada del pedido ${this.ordenAntes[0]}` }).click()
})

When('saca el primer pedido de la primera ruta', async function () {
  this.pedidoSacado = this.rutas[0].pedidos[0].id
  await this.pagina.getByRole('button', { name: `Sacar el pedido ${this.pedidoSacado} de la ruta` }).click()
})

When('mueve el primer pedido de la primera ruta a la segunda ruta', async function () {
  this.pedidoMovido = this.rutas[0].pedidos[0].id
  await this.pagina.locator(`#mover-${this.rutas[0].id}-${this.pedidoMovido}`).selectOption({ index: 1 })
})

When('cambia el repartidor de la primera ruta', async function () {
  this.repartidorAntes = this.rutas[0].repartidorId
  await this.pagina.locator(`#repartidor-ruta-${this.rutas[0].id}`).selectOption({ index: 1 })
})

Then('ve que el orden de las paradas cambió', async function () {
  await this.pagina.getByText('Se cambió el orden de las paradas').first().waitFor()
  const ruta = await (await fetch(`${this.api}/api/rutas/${this.rutas[0].id}`)).json()
  assert.notDeepStrictEqual(ruta.pedidos.map((pedido) => pedido.id), this.ordenAntes)
})

Then('el pedido sacado vuelve a PENDIENTE sin ruta', async function () {
  await this.pagina.getByText('volvió a PENDIENTE').first().waitFor()
  const pedido = await (await fetch(`${this.api}/api/pedidos/${this.pedidoSacado}`)).json()
  assert.strictEqual(pedido.estado, 'PENDIENTE')
  assert.strictEqual(pedido.rutaId, null)
})

Then('el pedido movido queda en la segunda ruta', async function () {
  await this.pagina.getByText(`El pedido ${this.pedidoMovido} se movió a la ruta ${this.rutas[1].id}`).first().waitFor()
  const pedido = await (await fetch(`${this.api}/api/pedidos/${this.pedidoMovido}`)).json()
  assert.strictEqual(pedido.rutaId, this.rutas[1].id)
})

Then('la ruta tiene otro repartidor', async function () {
  await this.pagina.getByText('Se cambió el repartidor de la ruta').first().waitFor()
  const ruta = await (await fetch(`${this.api}/api/rutas/${this.rutas[0].id}`)).json()
  assert.notStrictEqual(ruta.repartidorId, this.repartidorAntes)
})
