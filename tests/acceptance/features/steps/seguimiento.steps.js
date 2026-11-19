const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// CP-11 usa dos páginas del mismo navegador: this.pagina es la web del personal (Seguimiento abierto) y
// this.paginaMovil simula la app móvil del repartidor: no abre ninguna pantalla, solo llama a la API con
// page.request (es el único uso de page.request: así lo haría la app Flutter). Como la app, inicia sesión con el
// usuario del repartidor dueño de la ruta (rol COURIER): el backend saca de ese token el origen MOVIL del historial.

// Usuarios de repartidor de docs/api-auth.md, por id de repartidor (todos con la clave repartidor123).
const USUARIOS_REPARTIDOR = { 1: 'carlos', 2: 'luis', 3: 'andrea', 4: 'diego', 5: 'paola', 6: 'marco' }

Given('que existe un pedido del cliente de la prueba en la zona {string} para una fecha futura', async function (zona) {
  const puntos = { Centro: [-1.2412, -78.6197], Ingahurco: [-1.23, -78.62] }
  const [latitud, longitud] = puntos[zona]
  const respuesta = await fetch(`${this.api}/api/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: this.autorizacion },
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
  const armado = await fetch(`${this.api}/api/rutas/armar?fecha=${this.fechaLejana}`, { method: 'POST', headers: { Authorization: this.autorizacion } })
  assert.strictEqual(armado.status, 200)
  // el repartidor dueño de la ruta que quedó con el pedido (el armado elige al de menos carga: suele ser carlos)
  const pedido = await (await fetch(`${this.api}/api/pedidos/${this.pedido.id}`, { headers: { Authorization: this.autorizacion } })).json()
  const ruta = await (await fetch(`${this.api}/api/rutas/${pedido.rutaId}`, { headers: { Authorization: this.autorizacion } })).json()
  const usuario = USUARIOS_REPARTIDOR[ruta.repartidorId]
  assert.ok(usuario, `la ruta ${ruta.id} es del repartidor ${ruta.repartidorId}, que no tiene usuario de prueba`)

  this.paginaMovil = await this.navegador.newPage()
  const login = await this.paginaMovil.request.post(`${this.api}/api/auth/login`, { data: { usuario, clave: 'repartidor123' } })
  assert.strictEqual(login.status(), 200, `el repartidor ${usuario} no pudo iniciar sesión`)
  this.autorizacionMovil = `Bearer ${(await login.json()).token}`

  for (const estado of ['RECOGIDO', 'EN_CAMINO']) {
    const respuesta = await this.paginaMovil.request.patch(`${this.api}/api/pedidos/${this.pedido.id}/estado`, {
      headers: { Authorization: this.autorizacionMovil },
      data: { estado },
    })
    assert.strictEqual(respuesta.status(), 200)
  }
})

Given('que el personal tiene abierto Seguimiento con la fecha de ese pedido', async function () {
  await this.pagina.goto(`${this.web}/seguimiento`)
  await this.pagina.locator('#segFecha').fill(this.fechaLejana)
  await this.pagina.locator('#segBuscar').fill(this.cliente)
  await this.pagina.locator(`[data-testid="estado-pedido-${this.pedido.id}"]`).getByText('En camino').waitFor()
  // el tiempo real tiene que estar conectado antes de que el móvil cambie el estado
  await this.pagina.getByText('Tiempo real: conectado').waitFor()
  // si la web se recargara, la página dispara "load" otra vez
  this.recargada = false
  this.pagina.on('load', () => {
    this.recargada = true
  })
})

When('el repartidor marca el pedido como ENTREGADO desde la app móvil', async function () {
  const respuesta = await this.paginaMovil.request.patch(`${this.api}/api/pedidos/${this.pedido.id}/estado`, {
    headers: { Authorization: this.autorizacionMovil },
    data: { estado: 'ENTREGADO' },
  })
  assert.strictEqual(respuesta.status(), 200)
})

Then('Seguimiento muestra el pedido como {string} sin recargar la página', async function (estado) {
  await this.pagina.locator(`[data-testid="estado-pedido-${this.pedido.id}"]`).getByText(estado).waitFor({ timeout: 10000 })
  assert.strictEqual(this.recargada, false, 'la página se recargó')
})

Then('la pastilla {string} de Seguimiento cuenta {int} pedido', async function (estado, cantidad) {
  await this.pagina.getByRole('button', { name: `${estado} ${cantidad}`, exact: true }).waitFor()
})

When('abre el historial del pedido en Seguimiento', async function () {
  await this.pagina.getByRole('button', { name: `Ver historial del pedido ${this.pedido.id}` }).click()
})

Then('el historial registra el cambio a {string} hecho desde el móvil', async function (estado) {
  const ultimo = this.pagina.locator('.linea-tiempo li').last()
  await ultimo.getByText(estado).waitFor()
  await ultimo.getByText('MOVIL').waitFor()
})
