const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// Estos pasos solo se usan en login.feature (@pendiente). Necesitan la web levantada con VITE_AUTH_HABILITADA=true,
// el endpoint POST /api/auth/login del backend y usuarios de prueba, que se pasan por variables de entorno:
//   ACEP_USUARIO_PERSONAL / ACEP_CLAVE_PERSONAL   (rol STAFF)
//   ACEP_USUARIO_REPARTIDOR / ACEP_CLAVE_REPARTIDOR (rol COURIER)

Given('que el personal abre la pantalla de inicio de sesión', async function () {
  await this.pagina.goto(`${this.web}/login`)
})

When('abre la pantalla de Pedidos sin haber iniciado sesión', async function () {
  await this.pagina.goto(`${this.web}/pedidos`)
})

When('escribe el usuario y la clave del personal', async function () {
  await this.pagina.locator('#loginUsuario').fill(process.env.ACEP_USUARIO_PERSONAL ?? '')
  await this.pagina.locator('#loginClave').fill(process.env.ACEP_CLAVE_PERSONAL ?? '')
})

When('escribe el usuario y la clave de un repartidor', async function () {
  await this.pagina.locator('#loginUsuario').fill(process.env.ACEP_USUARIO_REPARTIDOR ?? '')
  await this.pagina.locator('#loginClave').fill(process.env.ACEP_CLAVE_REPARTIDOR ?? '')
})

When('escribe el usuario {string} y la clave {string}', async function (usuario, clave) {
  await this.pagina.locator('#loginUsuario').fill(usuario)
  await this.pagina.locator('#loginClave').fill(clave)
})

Then('ve la pantalla de inicio de sesión', async function () {
  await this.pagina.locator('#loginUsuario').waitFor()
  assert.ok(this.pagina.url().endsWith('/login'), `la dirección es ${this.pagina.url()}`)
})

Then('ve la pantalla de Inicio', async function () {
  await this.pagina.getByRole('heading', { name: 'Inicio', level: 1 }).waitFor()
})

Then('ve la pantalla {string}', async function (titulo) {
  await this.pagina.getByRole('heading', { name: titulo, level: 1 }).waitFor()
})
