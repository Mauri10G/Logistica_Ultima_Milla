const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// Un punto dentro de cada zona de los datos base (latitud, longitud)
const PUNTOS = {
  Centro: [-1.2412, -78.615],
  Ingahurco: [-1.23, -78.62],
  'Ficoa/Atocha': [-1.225, -78.635],
  'Norte/Izamba': [-1.21, -78.605],
  'Sur/Huachi': [-1.258, -78.62],
}

// ---------- Datos de partida (por la API) ----------

Given('que existe un pedido pendiente del cliente de la prueba en la zona {string} para mañana', async function (zona) {
  const [latitud, longitud] = PUNTOS[zona]
  const respuesta = await fetch(`${this.api}/api/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteNombres: this.cliente,
      clienteTelefono: '0990000000',
      direccion: `Calle original ${this.etiqueta}`,
      latitud,
      longitud,
      fechaEntrega: this.manana,
      horaEntrega: '10:00',
    }),
  })
  assert.strictEqual(respuesta.status, 201)
  this.pedido = await respuesta.json()
})

// ---------- Formulario de pedido ----------

When('escribe el nombre del cliente de la prueba', async function () {
  await this.pagina.locator('#clienteNombres').fill(this.cliente)
})

When('escribe {string} en el teléfono del cliente', async function (telefono) {
  await this.pagina.locator('#clienteTelefono').fill(telefono)
})

When('escribe {string} en el email del cliente', async function (email) {
  await this.pagina.locator('#clienteEmail').fill(email)
})

When('escribe {string} en la dirección de entrega', async function (direccion) {
  await this.pagina.locator('#direccion').fill(direccion)
})

When('elige la fecha de entrega {string}', async function (cual) {
  const fechas = { hoy: this.hoy, ayer: this.ayer, mañana: this.manana }
  await this.pagina.locator('#fechaEntrega').fill(fechas[cual])
})

When('escribe {string} en la hora de entrega', async function (hora) {
  await this.pagina.locator('#horaEntrega').fill(hora)
})

When('elige la prioridad {string}', async function (prioridad) {
  await this.pagina.locator('#prioridad').selectOption({ label: prioridad })
})

// ---------- Lista de pedidos ----------

When('busca al cliente de la prueba en la lista de pedidos', async function () {
  await this.pagina.locator('#buscarPedido').fill(this.cliente)
})

When('abre el detalle del pedido del cliente de la prueba', async function () {
  await this.pagina.getByRole('button', { name: `Ver pedido ${this.pedido.id}` }).click()
})

When('pulsa Editar en el pedido del cliente de la prueba', async function () {
  await this.pagina.getByRole('button', { name: `Editar pedido ${this.pedido.id}` }).click()
})

Then('ve al cliente de la prueba en la lista con estado {string} y zona {string}', async function (estado, zona) {
  const fila = this.pagina.getByRole('row', { name: this.cliente })
  await fila.waitFor()
  const texto = await fila.textContent()
  assert.ok(texto.includes(estado), `la fila "${texto}" no muestra el estado ${estado}`)
  assert.ok(texto.includes(zona), `la fila "${texto}" no muestra la zona ${zona}`)
})

Then('ve en la lista del cliente de la prueba la dirección {string}', async function (direccion) {
  await this.pagina.getByRole('row', { name: this.cliente }).getByText(direccion).waitFor()
})

Then('el detalle del pedido muestra {string}', async function (texto) {
  await this.pagina.getByRole('dialog').getByText(texto, { exact: true }).waitFor()
})

Then('ve el aviso de que el pedido de la prueba fue actualizado', async function () {
  await this.pagina.getByText(`Pedido ${this.pedido.id} actualizado.`).first().waitFor()
})

Then('ve el aviso de fecha {string} bajo el campo de fecha de entrega', async function (texto) {
  await this.pagina.getByText(texto).first().waitFor()
})

Then('ve el aviso de hora {string} bajo el campo de hora de entrega', async function (texto) {
  await this.pagina.getByText(texto).first().waitFor()
})

// ---------- Comprobaciones contra el backend ----------

Then('el sistema guardó el pedido del cliente de la prueba como {string} en la zona {string}', async function (estado, zona) {
  const lista = await (await fetch(`${this.api}/api/pedidos?fecha=${this.manana}&size=1000`)).json()
  const pedidos = lista.filter((pedido) => pedido.clienteNombres === this.cliente)
  assert.strictEqual(pedidos.length, 1, `se esperaba 1 pedido de ${this.cliente} y hay ${pedidos.length}`)
  assert.strictEqual(pedidos[0].estado, estado)
  assert.strictEqual(pedidos[0].zonaNombre, zona)
  assert.notStrictEqual(pedidos[0].fechaRegistro.slice(0, 10), pedidos[0].fechaEntrega, 'registro y entrega deben ser fechas distintas')
  this.pedido = pedidos[0]
})

Then('el pedido de la prueba tiene prioridad {string}', async function (prioridad) {
  assert.strictEqual(this.pedido.prioridad, prioridad)
})

Then('el pedido de la prueba quedó registrado por el personal del negocio', async function () {
  assert.strictEqual(this.pedido.registradoPorPersonal, true)
})

Then('el sistema no registró ningún pedido del cliente de la prueba', async function () {
  const lista = await (await fetch(`${this.api}/api/pedidos?size=1000`)).json()
  assert.strictEqual(lista.filter((pedido) => pedido.clienteNombres === this.cliente).length, 0)
})

Then('el pedido de la prueba sigue pendiente con la dirección {string}', async function (direccion) {
  const pedido = await (await fetch(`${this.api}/api/pedidos/${this.pedido.id}`)).json()
  assert.strictEqual(pedido.direccion, direccion)
  assert.strictEqual(pedido.estado, 'PENDIENTE')
})
