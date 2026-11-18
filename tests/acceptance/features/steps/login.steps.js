const { Given, When, Then } = require('@cucumber/cucumber')
const assert = require('assert')

// Pasos de login.feature y del Antecedente de los demás features. Necesitan el backend con SEGURIDAD_HABILITADA=true y la web con
// VITE_AUTH_HABILITADA=true. Los usuarios de prueba son los de docs/api-auth.md; se pueden cambiar con variables de entorno:
//   ACEP_USUARIO_PERSONAL / ACEP_CLAVE_PERSONAL     (rol STAFF, por defecto staff / staff123)
//   ACEP_USUARIO_REPARTIDOR / ACEP_CLAVE_REPARTIDOR (rol COURIER, por defecto carlos / repartidor123)
const USUARIO_PERSONAL = process.env.ACEP_USUARIO_PERSONAL ?? 'staff'
const CLAVE_PERSONAL = process.env.ACEP_CLAVE_PERSONAL ?? 'staff123'
const USUARIO_REPARTIDOR = process.env.ACEP_USUARIO_REPARTIDOR ?? 'carlos'
const CLAVE_REPARTIDOR = process.env.ACEP_CLAVE_REPARTIDOR ?? 'repartidor123'

// Antecedente de todos los features salvo login.feature: cada escenario empieza con el personal ya dentro de la web.
Given('que el personal inició sesión', async function () {
  await this.pagina.goto(`${this.web}/login`)
  await this.pagina.locator('#loginUsuario').fill(USUARIO_PERSONAL)
  await this.pagina.locator('#loginClave').fill(CLAVE_PERSONAL)
  await this.pagina.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await this.pagina.getByRole('heading', { name: 'Inicio', level: 1 }).waitFor()
})

Given('que el personal abre la pantalla de inicio de sesión', async function () {
  await this.pagina.goto(`${this.web}/login`)
})

When('abre la pantalla de Pedidos sin haber iniciado sesión', async function () {
  await this.pagina.goto(`${this.web}/pedidos`)
})

When('escribe el usuario y la clave del personal', async function () {
  await this.pagina.locator('#loginUsuario').fill(USUARIO_PERSONAL)
  await this.pagina.locator('#loginClave').fill(CLAVE_PERSONAL)
})

When('escribe el usuario y la clave de un repartidor', async function () {
  await this.pagina.locator('#loginUsuario').fill(USUARIO_REPARTIDOR)
  await this.pagina.locator('#loginClave').fill(CLAVE_REPARTIDOR)
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
