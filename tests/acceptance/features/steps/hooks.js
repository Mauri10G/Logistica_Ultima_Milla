const { Before, After, Status, setDefaultTimeout } = require('@cucumber/cucumber')
const { chromium } = require('playwright')
const { execFileSync } = require('child_process')

setDefaultTimeout(30 * 1000)

// Antes de cada escenario: navegador y página nuevos, una etiqueta única para nombrar sus datos y las fechas que usa.
Before(async function () {
  this.web = process.env.WEB_URL || 'http://localhost:5173'
  this.api = process.env.API_URL || 'http://localhost:8080'

  this.navegador = await chromium.launch({ headless: process.env.HEADED !== '1' })
  this.pagina = await this.navegador.newPage()

  // Todo lo que crea el escenario lleva esta etiqueta en su nombre: así es único y se puede limpiar al final.
  this.etiqueta = `ACEP${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`
  this.cliente = `Cliente ${this.etiqueta}`
  this.zona = `Zona ${this.etiqueta}`
  this.repartidor = `Repartidor ${this.etiqueta}`

  // Las fechas salen de la hora del SERVIDOR (la que usa el sistema), no de la del computador.
  const hora = await (await fetch(`${this.api}/api/servidor/hora`)).json()
  const sumarDias = (fecha, dias) => new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 24 * 3600 * 1000).toISOString().slice(0, 10)
  this.hoy = hora.fecha
  this.ayer = sumarDias(hora.fecha, -1)
  this.manana = sumarDias(hora.fecha, 1)

  // Fecha lejana y sin pedidos: el armado de rutas de un día no se mezcla con otros datos.
  for (let intento = 0; intento < 20; intento++) {
    this.fechaLejana = sumarDias(hora.fecha, 200 + Math.floor(Math.random() * 3000))
    const lista = await fetch(`${this.api}/api/pedidos?fecha=${this.fechaLejana}&size=1`)
    if (Number(lista.headers.get('X-Total-Count')) === 0) break
  }
})

// Después de cada escenario: captura si falló, cierra el navegador y borra de la base lo que creó (por la etiqueta).
After(async function (escenario) {
  if (escenario.result?.status === Status.FAILED && this.pagina) {
    this.attach(await this.pagina.screenshot(), 'image/png')
  }
  await this.navegador.close()

  const etiqueta = this.etiqueta
  const sql = [
    `DELETE FROM pedido WHERE cliente_id IN (SELECT id FROM cliente WHERE nombres LIKE '%${etiqueta}%')`,
    `DELETE FROM cliente WHERE nombres LIKE '%${etiqueta}%'`,
    `DELETE FROM ruta r WHERE r.fecha = '${this.fechaLejana}' AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.ruta_id = r.id)`,
    `DELETE FROM zona z WHERE z.nombre LIKE '%${etiqueta}%' AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.zona_id = z.id) AND NOT EXISTS (SELECT 1 FROM ruta r WHERE r.zona_id = z.id)`,
    `DELETE FROM repartidor d WHERE d.nombres LIKE '%${etiqueta}%' AND NOT EXISTS (SELECT 1 FROM ruta r WHERE r.repartidor_id = d.id)`,
  ].join('; ')
  try {
    execFileSync(
      'docker',
      ['exec', process.env.DB_CONTENEDOR || 'logistica-postgis', 'psql', '-U', 'logistica', '-d', 'logistica', '-v', 'ON_ERROR_STOP=1', '-c', sql],
      { stdio: 'pipe' },
    )
  } catch (error) {
    console.warn(`\nNo se pudo limpiar la base de datos (etiqueta ${etiqueta}): ${error.stderr?.toString() || error.message}`)
  }
})
