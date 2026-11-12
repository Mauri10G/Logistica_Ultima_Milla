#!/usr/bin/env node
/**
 * Generador de datos masivos: puebla el sistema para un dia de alta demanda (San Valentin). Primero completa
 * los repartidores y despues registra pedidos aleatorios DENTRO de las zonas activas, todo a traves de la API
 * (asi se ejercitan tambien las reglas de negocio). No tiene dependencias: solo Node 18+.
 *
 *   node tests/data/generar-pedidos.js --escenario normal          500 pedidos, 10 repartidores
 *   node tests/data/generar-pedidos.js                             alta demanda: 5000 pedidos, 40 repartidores
 *   node tests/data/generar-pedidos.js --escenario san-valentin    20000 pedidos, 80 repartidores
 *   node tests/data/generar-pedidos.js --cantidad 300 --repartidores 5 --fecha 2027-02-14 --concurrencia 10
 *   node tests/data/generar-pedidos.js --api http://servidor:8080 --armar     (arma las rutas al terminar)
 */
const { parseArgs } = require('node:util')
const { ESCENARIOS, resolverOpciones } = require('./lib/escenarios')
const { obtenerCabeceras } = require('./lib/auth')
const { asegurarRepartidores } = require('./lib/repartidores')

const { values: opciones } = parseArgs({
  options: {
    api: { type: 'string', default: 'http://localhost:8080' },
    escenario: { type: 'string' },
    cantidad: { type: 'string' },
    repartidores: { type: 'string' },
    fecha: { type: 'string' },
    concurrencia: { type: 'string' },
    armar: { type: 'boolean', default: false },
    ayuda: { type: 'boolean', default: false },
  },
})

if (opciones.ayuda) {
  console.log(
    'Uso: node generar-pedidos.js [--escenario normal|alta|san-valentin] [--api URL] [--cantidad N]\n' +
      '                             [--repartidores N] [--fecha YYYY-MM-DD] [--concurrencia N] [--armar]\n\nEscenarios:',
  )
  Object.entries(ESCENARIOS).forEach(([nombre, e]) =>
    console.log(`  ${nombre.padEnd(13)} ${e.pedidos} pedidos, ${e.repartidores} repartidores. ${e.descripcion}`),
  )
  process.exit(0)
}

let resueltas
try {
  resueltas = resolverOpciones(opciones)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const API = opciones.api.replace(/\/$/, '')
const CANTIDAD = resueltas.cantidad
const CONCURRENCIA = resueltas.concurrencia
const REPARTIDORES = resueltas.repartidores

/** Proximo 14 de febrero (el de este año si todavia no paso). */
function proximoSanValentin() {
  const hoy = new Date()
  const anio = hoy.getMonth() > 1 || (hoy.getMonth() === 1 && hoy.getDate() > 14) ? hoy.getFullYear() + 1 : hoy.getFullYear()
  return `${anio}-02-14`
}
const FECHA = opciones.fecha || proximoSanValentin()

const NOMBRES = ['Maria', 'Jose', 'Luis', 'Ana', 'Carlos', 'Lucia', 'Pedro', 'Sofia', 'Diego', 'Camila', 'Jorge', 'Elena']
const APELLIDOS = ['Torres', 'Mena', 'Salazar', 'Naranjo', 'Vargas', 'Cevallos', 'Paredes', 'Lopez', 'Guevara', 'Chachalo']
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)]

/** Mensaje de un error de red con su causa (p. ej. "fetch failed (ECONNREFUSED)"). */
const describirError = (error) => (error.cause?.code ? `${error.message} (${error.cause.code})` : error.message)

/** Punto dentro del poligono (ray casting) */
function dentro([lng, lat], anillo) {
  let adentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) adentro = !adentro
  }
  return adentro
}

function puntoAleatorioEn(zona) {
  const anillo = zona.area.coordinates[0]
  const lngs = anillo.map((p) => p[0])
  const lats = anillo.map((p) => p[1])
  const [minLng, maxLng, minLat, maxLat] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)]
  for (let intento = 0; intento < 1000; intento++) {
    const punto = [minLng + Math.random() * (maxLng - minLng), minLat + Math.random() * (maxLat - minLat)]
    if (dentro(punto, anillo)) return punto
  }
  throw new Error(`No se pudo generar un punto dentro de la zona ${zona.nombre}`)
}

/** Demanda de San Valentin: concentrada entre las 10:00 y las 19:00, con pico a media tarde. */
function horaAleatoria() {
  const hora = Math.min(21, Math.max(8, Math.round(14 + (Math.random() + Math.random() + Math.random() - 1.5) * 5)))
  const minutos = elegir([0, 15, 30, 45])
  return `${String(hora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

function pedidoAleatorio(zonas, indice) {
  // Algunas zonas (centro) reciben mas pedidos que otras
  const zona = zonas[Math.floor(Math.pow(Math.random(), 1.6) * zonas.length)]
  const [longitud, latitud] = puntoAleatorioEn(zona)
  const azar = Math.random()
  return {
    clienteNombres: `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`,
    clienteTelefono: `09${String(80000000 + (indice % 19999999))}`,
    direccion: `Calle ${Math.floor(Math.random() * 200) + 1} y Av. ${Math.floor(Math.random() * 50) + 1} (${zona.nombre})`,
    latitud,
    longitud,
    fechaEntrega: FECHA,
    horaEntrega: horaAleatoria(),
    prioridad: azar < 0.1 ? 'URGENTE' : azar < 0.3 ? 'ALTA' : 'NORMAL',
    registradoPorPersonal: Math.random() < 0.3,
  }
}

async function main() {
  const cabeceras = await obtenerCabeceras(API)
  if (cabeceras.Authorization) console.log(`Sesion iniciada como ${process.env.API_USUARIO}.`)

  const respuestaZonas = await fetch(`${API}/api/zonas?soloActivas=true`, { headers: cabeceras })
  if (!respuestaZonas.ok) throw new Error(`No se pudieron leer las zonas: HTTP ${respuestaZonas.status}`)
  const zonas = await respuestaZonas.json()
  if (zonas.length === 0) throw new Error('No hay zonas activas')

  if (REPARTIDORES > 0) {
    const { existentes, creados } = await asegurarRepartidores(API, REPARTIDORES, cabeceras)
    console.log(`Repartidores disponibles: ${existentes + creados} (${creados} nuevos).`)
  }

  console.log(
    `Escenario ${resueltas.escenario}: ${CANTIDAD} pedidos para ${FECHA} en ${zonas.length} zonas (${CONCURRENCIA} en paralelo)...`,
  )
  const inicio = Date.now()
  let siguiente = 0
  let creados = 0
  const errores = new Map()

  async function trabajador() {
    while (siguiente < CANTIDAD) {
      const indice = siguiente++
      try {
        const respuesta = await fetch(`${API}/api/pedidos`, {
          method: 'POST',
          headers: cabeceras,
          body: JSON.stringify(pedidoAleatorio(zonas, indice)),
        })
        if (respuesta.status === 201) {
          creados++
        } else {
          const clave = `HTTP ${respuesta.status} ${(await respuesta.text()).slice(0, 120)}`
          errores.set(clave, (errores.get(clave) ?? 0) + 1)
        }
      } catch (error) {
        const motivo = describirError(error)
        errores.set(motivo, (errores.get(motivo) ?? 0) + 1)
      }
      if ((indice + 1) % 500 === 0) console.log(`  ${indice + 1}/${CANTIDAD}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador))

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
  console.log(`Listo: ${creados} pedidos creados en ${segundos} s (${(creados / segundos).toFixed(0)} pedidos/s).`)
  const fallidos = CANTIDAD - creados
  if (fallidos > 0) {
    console.error(`${fallidos} pedidos fallaron:`)
    errores.forEach((cantidad, motivo) => console.error(`  ${cantidad} x ${motivo}`))
  }

  if (opciones.armar) {
    console.log(`Armando rutas de ${FECHA}...`)
    const t0 = Date.now()
    const respuesta = await fetch(`${API}/api/rutas/armar?fecha=${FECHA}`, { method: 'POST', headers: cabeceras })
    if (!respuesta.ok) {
      console.error(`El armado de rutas fallo: HTTP ${respuesta.status} ${(await respuesta.text()).slice(0, 200)}`)
      process.exitCode = 1
      return
    }
    const rutas = await respuesta.json()
    console.log(`Armado: HTTP ${respuesta.status}, ${Array.isArray(rutas) ? rutas.length : '?'} rutas en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  }
  process.exitCode = fallidos > CANTIDAD * 0.01 ? 1 : 0
}

main().catch((error) => {
  console.error(describirError(error))
  process.exitCode = 1
})
