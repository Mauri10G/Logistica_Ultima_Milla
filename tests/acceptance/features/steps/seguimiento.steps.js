const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// CP-11 usa dos páginas del mismo navegador: this.pagina es la web del personal (Seguimiento abierto) y
// this.paginaMovil hace de la app móvil del repartidor: solo llama a la API, como lo haría la app Flutter.

Given('que existe un pedido del cliente de la prueba en la zona {string} para una fecha futura', async function (zona) {
  const puntos = { Centro: [-1.2412, -78.6197], Ingahurco: [-1.23, -78.62] }
  const [latitud, longitud] = puntos[zona]
  const respuesta = await fetch(`${this.api}/api/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteNombres: this.cliente,
      clienteTelefono: '0990000000',
      direccion: `Calle de seguimiento ${this.etiqueta}`,
      latitud,
      longitud,
      fechaEntrega: this.fechaLejana,
      horaEntrega: '10:00',
    }),
  })
  assert.strictEqual(respuesta.status, 201)
  this.pedido = await respuesta.json()
})

Given('que el repartidor ya recogió el pedido y va en camino', async function () {
  // el armado deja el pedido ASIGNADO; el resto del recorrido lo hace el repartidor desde la app móvil
  const armado = await fetch(`${this.api}/api/rutas/armar?fecha=${this.fechaLejana}`, { method: 'POST' })
  assert.strictEqual(armado.status, 200)
  this.paginaMovil = await this.navegador.newPage()
  for (const estado of ['RECOGIDO', 'EN_CAMINO']) {
    const respuesta = await this.paginaMovil.request.patch(`${this.api}/api/pedidos/${this.pedido.id}/estado`, {
      data: { estado, origen: 'MOVIL' },
    })
    assert.strictEqual(respuesta.status(), 200)
  }
})

Given('que el personal tiene abierto Seguimiento con la fecha de ese pedido', async function () {
  await this.pagina.goto(`${this.web}/seguimiento`)
  await this.pagina.locator('#segFecha').fill(this.fechaLejana)
  await this.pagina.locator('#segBuscar').fill(this.cliente)
  await this.pagina.locator(`[data-testid="estado-pedido-${this.pedido.id}"]`, { hasText: 'En camino' }).waitFor()
  // el tiempo real tiene que estar conectado antes de que el móvil cambie el estado
  await this.pagina.locator('.conexion-ok', { hasText: 'conectado' }).waitFor()
  // marca en la página: si la web se recargara, la marca desaparecería
  await this.pagina.evaluate(() => {
    window.sinRecargar = true
  })
})

When('el repartidor marca el pedido como ENTREGADO desde la app móvil', async function () {
  const respuesta = await this.paginaMovil.request.patch(`${this.api}/api/pedidos/${this.pedido.id}/estado`, {
    data: { estado: 'ENTREGADO', origen: 'MOVIL' },
  })
  assert.strictEqual(respuesta.status(), 200)
})

Then('Seguimiento muestra el pedido como {string} sin recargar la página', async function (estado) {
  await this.pagina.locator(`[data-testid="estado-pedido-${this.pedido.id}"]`, { hasText: estado }).waitFor({ timeout: 10000 })
  assert.strictEqual(await this.pagina.evaluate(() => window.sinRecargar), true, 'la página se recargó')
})

Then('la pastilla {string} de Seguimiento cuenta {int} pedido', async function (estado, cantidad) {
  const pastilla = this.pagina.locator('.pastilla-filtro', { hasText: estado }).first()
  await pastilla.waitFor()
  assert.ok((await pastilla.textContent()).trim().endsWith(String(cantidad)), `la pastilla muestra "${await pastilla.textContent()}"`)
})

When('abre el historial del pedido en Seguimiento', async function () {
  await this.pagina.getByRole('button', { name: `Ver historial del pedido ${this.pedido.id}` }).click()
})

Then('el historial registra el cambio a {string} hecho desde el móvil', async function (estado) {
  const ultimo = this.pagina.locator('.linea-tiempo li').last()
  await ultimo.filter({ hasText: estado }).waitFor()
  assert.ok((await ultimo.textContent()).includes('MOVIL'), 'el último cambio no tiene origen MOVIL')
})
