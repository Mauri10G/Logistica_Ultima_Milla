#!/usr/bin/env node
// Prueba en vivo de las validaciones de campos del backend: envia casos limite a la API (con la seguridad encendida) y
// compara el codigo HTTP con el esperado. Los pedidos que llega a crear los borra al final.
//
//   node tests/security/validaciones.js                       backend en http://localhost:8080
//   node tests/security/validaciones.js http://servidor:8080
//
// Termina con codigo 1 si algun caso no responde lo esperado. Sin dependencias: Node 18+.
const API = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '')
const creados = []
let token = null
const filas = []

async function llamar(metodo, ruta, cuerpo, conToken = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (conToken && token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(API + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) })
  let json = null
  try { json = await r.json() } catch { /* sin cuerpo */ }
  return { status: r.status, json }
}

function hoyMas(dias) {
  const d = new Date(Date.now() - 5 * 3600e3 + dias * 86400e3) // America/Guayaquil (UTC-5)
  return d.toISOString().slice(0, 10)
}
const base = () => ({
  clienteNombres: 'Prueba Validacion', clienteTelefono: '0991112233', direccion: 'Bolivar y Mera',
  latitud: -1.2412, longitud: -78.6197, fechaEntrega: hoyMas(3), horaEntrega: '10:00', prioridad: 'NORMAL',
})

async function caso(area, nombre, esperado, fn) {
  const { status, json } = await fn()
  if (status === 201 && json?.id && area === 'Pedido') creados.push(json.id)
  const detalle = json?.errores ? Object.entries(json.errores).map(([k, v]) => `${k}: ${v}`).join('; ') : (json?.mensaje || '')
  const ok = String(esperado).split('|').includes(String(status))
  filas.push({ area, nombre, esperado, obtenido: status, ok, codigo: json?.codigo || '', detalle: String(detalle).slice(0, 110) })
}

async function main() {
  // --- Login
  await caso('Login', 'usuario vacio', 400, () => llamar('POST', '/api/auth/login', { usuario: '', clave: 'x' }, false))
  await caso('Login', 'clave vacia', 400, () => llamar('POST', '/api/auth/login', { usuario: 'staff', clave: '' }, false))
  await caso('Login', 'clave incorrecta', 401, () => llamar('POST', '/api/auth/login', { usuario: 'staff', clave: 'mala' }, false))
  await caso('Login', 'usuario con mayusculas (Staff)', 200, () => llamar('POST', '/api/auth/login', { usuario: 'Staff', clave: 'staff123' }, false))
  await caso('Login', 'usuario de 51 caracteres', 400, () => llamar('POST', '/api/auth/login', { usuario: 'a'.repeat(51), clave: 'x' }, false))
  token = (await llamar('POST', '/api/auth/login', { usuario: 'staff', clave: 'staff123' }, false)).json.token
  await caso('Seguridad', 'sin token', 401, () => llamar('GET', '/api/zonas', undefined, false))
  await caso('Seguridad', 'token falso', 401, async () => { const t = token; token = 'abc.def.ghi'; const r = await llamar('GET', '/api/zonas'); token = t; return r })
  const tokCourier = (await llamar('POST', '/api/auth/login', { usuario: 'carlos', clave: 'repartidor123' }, false)).json.token
  await caso('Seguridad', 'repartidor intenta ver zonas', 403, async () => { const t = token; token = tokCourier; const r = await llamar('GET', '/api/zonas'); token = t; return r })

  // --- Pedido
  await caso('Pedido', 'valido (control)', 201, () => llamar('POST', '/api/pedidos', base()))
  await caso('Pedido', 'sin direccion', 400, () => llamar('POST', '/api/pedidos', { ...base(), direccion: '' }))
  await caso('Pedido', 'direccion solo espacios', 400, () => llamar('POST', '/api/pedidos', { ...base(), direccion: '   ' }))
  await caso('Pedido', 'direccion de 256 caracteres', 400, () => llamar('POST', '/api/pedidos', { ...base(), direccion: 'x'.repeat(256) }))
  await caso('Pedido', 'sin cliente (ni id ni datos)', 400, () => llamar('POST', '/api/pedidos', { ...base(), clienteNombres: '', clienteTelefono: '' }))
  await caso('Pedido', 'clienteId inexistente', 404, () => llamar('POST', '/api/pedidos', { ...base(), clienteId: 999999 }))
  await caso('Pedido', 'nombre de 151 caracteres', 400, () => llamar('POST', '/api/pedidos', { ...base(), clienteNombres: 'n'.repeat(151) }))
  await caso('Pedido', 'telefono de 31 caracteres', 400, () => llamar('POST', '/api/pedidos', { ...base(), clienteTelefono: '9'.repeat(31) }))
  await caso('Pedido', 'telefono con letras "abc"', 400, () => llamar('POST', '/api/pedidos', { ...base(), clienteTelefono: 'abc' }))
  await caso('Pedido', 'nombre solo numeros "12345"', 400, () => llamar('POST', '/api/pedidos', { ...base(), clienteNombres: '12345' }))
  await caso('Pedido', 'email invalido', 400, () => llamar('POST', '/api/pedidos', { ...base(), clienteEmail: 'no-es-email' }))
  await caso('Pedido', 'sin latitud', 400, () => llamar('POST', '/api/pedidos', { ...base(), latitud: null }))
  await caso('Pedido', 'latitud 91', 400, () => llamar('POST', '/api/pedidos', { ...base(), latitud: 91 }))
  await caso('Pedido', 'longitud 181', 400, () => llamar('POST', '/api/pedidos', { ...base(), longitud: 181 }))
  await caso('Pedido', 'punto fuera de toda zona (CP-03)', 422, () => llamar('POST', '/api/pedidos', { ...base(), latitud: 0, longitud: 0 }))
  await caso('Pedido', 'fecha ayer (CP-04)', 422, () => llamar('POST', '/api/pedidos', { ...base(), fechaEntrega: hoyMas(-1) }))
  await caso('Pedido', 'hoy a las 00:00 (anticipacion 30 min)', 422, () => llamar('POST', '/api/pedidos', { ...base(), fechaEntrega: hoyMas(0), horaEntrega: '00:00' }))
  await caso('Pedido', 'fecha con formato invalido', 400, () => llamar('POST', '/api/pedidos', { ...base(), fechaEntrega: '2026-13-45' }))
  await caso('Pedido', 'hora invalida 25:00', 400, () => llamar('POST', '/api/pedidos', { ...base(), horaEntrega: '25:00' }))
  await caso('Pedido', 'prioridad inexistente', 400, () => llamar('POST', '/api/pedidos', { ...base(), prioridad: 'MAXIMA' }))
  await caso('Pedido', 'JSON mal formado', 400, () => llamar('POST', '/api/pedidos', '{"direccion": '))
  await caso('Pedido', 'fecha dentro de 5 anios', '400|422', () => llamar('POST', '/api/pedidos', { ...base(), fechaEntrega: hoyMas(365 * 5) }))
  await caso('Pedido', 'estado nulo en PATCH', 400, () => llamar('PATCH', `/api/pedidos/${creados[0]}/estado`, { estado: null }))
  await caso('Pedido', 'saltar a ENTREGADO desde PENDIENTE', 409, () => llamar('PATCH', `/api/pedidos/${creados[0]}/estado`, { estado: 'ENTREGADO' }))
  await caso('Pedido', 'listar con sort invalido', 400, () => llamar('GET', '/api/pedidos?sort=clave,asc'))
  // size fuera de 1..1000 no es un error: el backend lo ajusta al rango (Math.clamp)
  await caso('Pedido', 'listar con size=0 (se ajusta a 1)', 200, () => llamar('GET', '/api/pedidos?size=0'))
  await caso('Pedido', 'listar con size=5000 (se ajusta a 1000)', 200, () => llamar('GET', '/api/pedidos?size=5000'))
  await caso('Pedido', 'listar con fecha mal escrita', 400, () => llamar('GET', '/api/pedidos?fecha=ayer'))

  // --- Repartidor (solo casos que NO crean registros)
  const rep = { nombres: 'Rep Prueba', telefono: '0990000000', usuario: 'rep.validacion', clave: 'secreto1' }
  await caso('Repartidor', 'sin nombres', 400, () => llamar('POST', '/api/repartidores', { ...rep, nombres: '' }))
  await caso('Repartidor', 'sin telefono', 400, () => llamar('POST', '/api/repartidores', { ...rep, telefono: '' }))
  await caso('Repartidor', 'sin usuario', 400, () => llamar('POST', '/api/repartidores', { ...rep, usuario: '' }))
  await caso('Repartidor', 'usuario de 2 caracteres', 400, () => llamar('POST', '/api/repartidores', { ...rep, usuario: 'ab' }))
  await caso('Repartidor', 'usuario con mayusculas', 400, () => llamar('POST', '/api/repartidores', { ...rep, usuario: 'Ana.Ruiz' }))
  await caso('Repartidor', 'usuario con espacio', 400, () => llamar('POST', '/api/repartidores', { ...rep, usuario: 'ana ruiz' }))
  await caso('Repartidor', 'usuario duplicado (carlos)', 409, () => llamar('POST', '/api/repartidores', { ...rep, usuario: 'carlos' }))
  await caso('Repartidor', 'clave de 5 caracteres', 400, () => llamar('POST', '/api/repartidores', { ...rep, clave: '12345' }))
  await caso('Repartidor', 'clave de 73 caracteres', 400, () => llamar('POST', '/api/repartidores', { ...rep, clave: 'c'.repeat(73) }))
  await caso('Repartidor', 'capacidad 0', 400, () => llamar('POST', '/api/repartidores', { ...rep, capacidadMaxima: 0 }))
  await caso('Repartidor', 'disponibilidad nula', 400, () => llamar('PATCH', '/api/repartidores/1/disponibilidad', { disponible: null }))
  await caso('Repartidor', 'id inexistente', 404, () => llamar('GET', '/api/repartidores/999999'))
  await caso('Repartidor', 'PUT capacidad 0', 400, () => llamar('PUT', '/api/repartidores/1', { nombres: 'Carlos Mena', telefono: '0991000001', capacidadMaxima: 0 }))

  // --- Zona (solo casos que NO crean registros)
  const cuadro = { type: 'Polygon', coordinates: [[[-78.70, -1.30], [-78.69, -1.30], [-78.69, -1.29], [-78.70, -1.29], [-78.70, -1.30]]] }
  await caso('Zona', 'sin nombre', 400, () => llamar('POST', '/api/zonas', { nombre: '', area: cuadro }))
  await caso('Zona', 'nombre de 101 caracteres', 400, () => llamar('POST', '/api/zonas', { nombre: 'z'.repeat(101), area: cuadro }))
  await caso('Zona', 'sin area', 400, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba' }))
  await caso('Zona', 'nombre duplicado (Centro)', 409, () => llamar('POST', '/api/zonas', { nombre: 'Centro', area: cuadro }))
  await caso('Zona', 'area tipo Point', 400, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba', area: { type: 'Point', coordinates: [-78.6, -1.2] } }))
  await caso('Zona', 'anillo con 3 puntos', 400, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba', area: { type: 'Polygon', coordinates: [[[-78.7, -1.3], [-78.69, -1.3], [-78.7, -1.3]]] } }))
  await caso('Zona', 'anillo sin cerrar', 400, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba', area: { type: 'Polygon', coordinates: [[[-78.70, -1.30], [-78.69, -1.30], [-78.69, -1.29], [-78.70, -1.29]]] } }))
  await caso('Zona', 'poligono en forma de 8 (auto-interseccion)', 400, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba', area: { type: 'Polygon', coordinates: [[[-78.70, -1.30], [-78.69, -1.29], [-78.69, -1.30], [-78.70, -1.29], [-78.70, -1.30]]] } }))
  await caso('Zona', 'coordenada fuera de rango', 400, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba', area: { type: 'Polygon', coordinates: [[[-200, -1.30], [-78.69, -1.30], [-78.69, -1.29], [-200, -1.30]]] } }))
  await caso('Zona', 'superpuesta con Centro sin confirmar', 409, () => llamar('POST', '/api/zonas', { nombre: 'Z prueba', area: { type: 'Polygon', coordinates: [[[-78.62, -1.245], [-78.61, -1.245], [-78.61, -1.238], [-78.62, -1.238], [-78.62, -1.245]]] } }))

  // --- Rutas
  await caso('Ruta', 'armar sin fecha', 400, () => llamar('POST', '/api/rutas/armar'))
  await caso('Ruta', 'armar con fecha invalida', 400, () => llamar('POST', '/api/rutas/armar?fecha=mañana'))
  await caso('Ruta', 'reordenar con lista vacia', 400, () => llamar('PUT', '/api/rutas/1/orden', { pedidos: [] }))
  await caso('Ruta', 'cambiar repartidor sin id', 400, () => llamar('PATCH', '/api/rutas/1/repartidor', { repartidorId: null }))

  // Limpieza de los pedidos de prueba
  for (const id of creados) await llamar('DELETE', `/api/pedidos/${id}`)

  let fallidos = 0
  for (const r of filas) {
    if (!r.ok) fallidos++
    console.log(`${r.ok ? 'OK' : 'XX'}  ${r.area.padEnd(10)} ${r.nombre.padEnd(44)} esperado ${String(r.esperado).padEnd(7)} obtenido ${r.obtenido} ${r.codigo}${r.ok ? '' : '  ' + r.detalle}`)
  }
  console.log(`
${filas.length - fallidos} de ${filas.length} casos responden como se espera.`)
  process.exitCode = fallidos > 0 ? 1 : 0
}
main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
