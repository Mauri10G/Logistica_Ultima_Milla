const { When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

When('escribe el nombre del repartidor de la prueba', async function () {
  await this.pagina.locator('#repNombres').fill(this.repartidor)
})

When('escribe {string} en el teléfono del repartidor', async function (telefono) {
  await this.pagina.locator('#repTelefono').fill(telefono)
})

When('escribe el usuario y la contraseña del repartidor de la prueba', async function () {
  await this.pagina.locator('#repUsuario').fill(this.usuarioRepartidor)
  await this.pagina.locator('#repClave').fill(this.claveRepartidor)
})

When('busca al repartidor de la prueba', async function () {
  await this.pagina.locator('#buscarRepartidor').fill(this.repartidor)
})

When('apaga la disponibilidad del repartidor de la prueba', async function () {
  // el interruptor es un <input> debajo de una pista dibujada: se pulsa su texto "Disponible", como lo haría el usuario
  await this.pagina.getByRole('row', { name: this.repartidor }).getByText('Disponible').click()
})

Then('ve el aviso de que el repartidor de la prueba fue agregado', async function () {
  await this.pagina.getByText(`Repartidor ${this.repartidor} agregado.`).first().waitFor()
})

Then('ve al repartidor de la prueba en la tabla con teléfono {string}', async function (telefono) {
  const fila = this.pagina.getByRole('row', { name: this.repartidor })
  await fila.waitFor()
  assert.ok((await fila.textContent()).includes(telefono), `la fila no muestra el teléfono ${telefono}`)
})

Then('el repartidor de la prueba puede iniciar sesión en la app con su usuario', async function () {
  const respuesta = await fetch(`${this.api}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: this.usuarioRepartidor, clave: this.claveRepartidor }),
  })
  assert.strictEqual(respuesta.status, 200, `el login del repartidor respondió HTTP ${respuesta.status}`)
  const sesion = await respuesta.json()
  assert.strictEqual(sesion.rol, 'COURIER')
  assert.ok(sesion.repartidorId, 'el token no trae repartidorId')
})

Then('el interruptor de disponibilidad del repartidor de la prueba está {string}', async function (estado) {
  // tras pulsarlo la tabla se recarga con lo que guardó el backend: getByRole espera hasta que el interruptor coincide
  await this.pagina.getByRole('switch', { name: `Disponible de ${this.repartidor}`, checked: estado === 'encendido' }).waitFor()
})

Then('el sistema guardó al repartidor de la prueba como disponible {string}', async function (valor) {
  const repartidores = await (await fetch(`${this.api}/api/repartidores`, { headers: { Authorization: this.autorizacion } })).json()
  const guardado = repartidores.find((r) => r.nombres === this.repartidor)
  assert.ok(guardado, `el repartidor ${this.repartidor} no existe`)
  assert.strictEqual(guardado.disponible, valor === 'sí')
  assert.strictEqual(guardado.activo, true)
})
