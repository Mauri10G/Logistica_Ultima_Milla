#!/usr/bin/env node
/**
 * Genera las graficas del informe de rendimiento a partir de los resumenes de k6 (tests/performance/reports/*.json).
 * Escribe SVG en docs/evidencias/performance/graficas/, con modo claro y oscuro y el valor de cada marca como
 * tooltip (al abrir el SVG). Sin dependencias: solo Node 18+.
 *
 *   node tests/performance/graficas.js
 *
 * Usa: estres.json y estres-alto.json (niveles de usuarios), volumen-normal.json, volumen-alta-consultas.json,
 * volumen-san-valentin-consultas.json y volumen-<escenario>.json (armado).
 */
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..', '..')
const REPORTES = path.join(__dirname, 'reports')
const SALIDA = path.join(RAIZ, 'docs', 'evidencias', 'performance', 'graficas')

const leer = (nombre) => JSON.parse(fs.readFileSync(path.join(REPORTES, nombre), 'utf8')).metrics
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2).replace('.', ',')} s` : `${Math.round(v)} ms`)
const miles = (n) => Math.round(n).toLocaleString('es-EC')

// Paleta de referencia (validada con dataviz/scripts/validate_palette.js en claro y oscuro)
const ESTILO = `
  .fondo { fill: #fcfcfb } .t1 { fill: #0b0b0b } .t2 { fill: #52514e } .t3 { fill: #898781 }
  .grilla { stroke: #e1e0d9 } .eje { stroke: #c3c2b7 } .umbral { stroke: #52514e }
  .s1 { fill: #2a78d6 } .s1l { stroke: #2a78d6 } .s2 { fill: #eb6834 } .anillo { stroke: #fcfcfb }
  .halo { paint-order: stroke; stroke: #fcfcfb; stroke-width: 4px; stroke-linejoin: round }
  @media (prefers-color-scheme: dark) {
    .fondo { fill: #1a1a19 } .t1 { fill: #f0efec } .t2 { fill: #c3c2b7 } .t3 { fill: #898781 }
    .grilla { stroke: #2c2c2a } .eje { stroke: #383835 } .umbral { stroke: #c3c2b7 }
    .s1 { fill: #3987e5 } .s1l { stroke: #3987e5 } .s2 { fill: #d95926 } .anillo { stroke: #1a1a19 }
    .halo { stroke: #1a1a19 }
  }
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif }
  .num { font-variant-numeric: tabular-nums }`

const ANCHO = 760
const ALTO = 380
const M = { arriba: 78, derecha: 24, abajo: 52, izquierda: 64 }

/** Escala "bonita" de 0 a un maximo redondeado, con 4 a 6 marcas. */
function escala(maximo) {
  const paso0 = maximo / 5
  const mag = 10 ** Math.floor(Math.log10(paso0))
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= paso0)
  const tope = Math.ceil(maximo / paso) * paso
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) }
}

function marco(titulo, subtitulo, cuerpo, descripcion) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-labelledby="titulo desc">
<title id="titulo">${esc(titulo)}</title><desc id="desc">${esc(descripcion)}</desc>
<style>${ESTILO}</style>
<rect class="fondo" width="${ANCHO}" height="${ALTO}" rx="8"/>
<text class="t1" x="${M.izquierda}" y="30" font-size="16" font-weight="600">${esc(titulo)}</text>
<text class="t2" x="${M.izquierda}" y="50" font-size="12.5">${esc(subtitulo)}</text>
${cuerpo}
</svg>
`
}

/** Grilla horizontal y eje Y. */
function ejeY(esc_, alto, formato) {
  const y = (v) => M.arriba + alto - (v / esc_.tope) * alto
  return {
    y,
    svg: esc_.marcas
      .map((v) => `<line class="${v === 0 ? 'eje' : 'grilla'}" x1="${M.izquierda}" x2="${ANCHO - M.derecha}" y1="${y(v)}" y2="${y(v)}" stroke-width="1"/>
<text class="t3 num" x="${M.izquierda - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end">${esc(formato(v))}</text>`)
      .join('\n'),
  }
}

/** Barra con el extremo de datos redondeado (4 px) y la base recta. */
function barra(x, y0, y1, ancho, clase, tooltip) {
  const r = Math.min(4, (y0 - y1) / 2, ancho / 2)
  const d = `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + ancho - r} Q${x + ancho},${y1} ${x + ancho},${y1 + r} V${y0} Z`
  return `<path class="${clase}" d="${d}"><title>${esc(tooltip)}</title></path>`
}

function lineaUmbral(y, texto, izquierda = false) {
  const xTexto = izquierda ? M.izquierda + 6 : ANCHO - M.derecha
  const yTexto = izquierda ? y + 15 : y - 6
  return `<line class="umbral" x1="${M.izquierda}" x2="${ANCHO - M.derecha}" y1="${y}" y2="${y}" stroke-width="1" stroke-dasharray="4 4"/>
<text class="t2" x="${xTexto}" y="${yTexto}" font-size="11" text-anchor="${izquierda ? 'start' : 'end'}">${esc(texto)}</text>`
}

// ---------- Datos ----------
function nivelesEstres() {
  const filas = []
  for (const archivo of ['estres.json', 'estres-alto.json']) {
    const m = leer(archivo)
    for (const clave of Object.keys(m)) {
      const f = clave.match(/^http_req_duration\{fase:n(\d+)\}$/)
      if (!f) continue
      const fallos = m[`http_req_failed{fase:n${f[1]}}`]
      const total = fallos.passes + fallos.fails
      filas.push({ usuarios: Number(f[1]), p95: m[clave]['p(95)'], porSegundo: total / 60, errores: fallos.passes / total })
    }
  }
  return filas.sort((a, b) => a.usuarios - b.usuarios)
}

function recuperacion() {
  return ['estres.json', 'estres-alto.json'].map((a) => leer(a)['http_req_duration{fase:recuperacion}']['p(95)'])
}

const ESCENARIOS = [
  { nombre: 'Normal', pedidos: 500, rutas: 127, consultas: 'volumen-normal.json', armado: 'volumen-normal.json' },
  { nombre: 'Alta demanda', pedidos: 5000, rutas: 1251, consultas: 'volumen-alta-consultas.json', armado: 'volumen-alta.json' },
  { nombre: 'San Valentín', pedidos: 20000, rutas: 5003, consultas: 'volumen-san-valentin-consultas.json', armado: 'volumen-san-valentin.json' },
]

// ---------- Graficas ----------
function graficaEstresP95(niveles, recup) {
  const UMBRAL = 800
  const alto = ALTO - M.arriba - M.abajo
  const e = escala(Math.max(...niveles.map((n) => n.p95)) * 1.1)
  const { y, svg: grilla } = ejeY(e, alto, (v) => (v >= 1000 ? `${v / 1000} s` : `${v} ms`))
  const paso = (ANCHO - M.izquierda - M.derecha) / niveles.length
  const x = (i) => M.izquierda + paso * (i + 0.5)
  const quiebre = niveles.findIndex((n) => n.p95 > UMBRAL)
  const linea = niveles.map((n, i) => `${i ? 'L' : 'M'}${x(i)},${y(n.p95)}`).join(' ')
  const puntos = niveles
    .map((n, i) => `<circle class="s1 anillo" cx="${x(i)}" cy="${y(n.p95)}" r="5" stroke-width="2"><title>${miles(n.usuarios)} usuarios: p95 ${ms(n.p95)}, ${(n.errores * 100).toFixed(2)} % de errores</title></circle>`)
    .join('\n')
  const ejeX = niveles.map((n, i) => `<text class="t3 num" x="${x(i)}" y="${M.arriba + alto + 18}" font-size="11" text-anchor="middle">${miles(n.usuarios)}</text>`).join('\n')
  const etiquetas = [0, quiebre, niveles.length - 1]
    .filter((i, k, arr) => i >= 0 && arr.indexOf(i) === k)
    .map((i) => `<text class="t1 num halo" x="${x(i)}" y="${y(niveles[i].p95) - 12}" font-size="11.5" font-weight="600" text-anchor="middle">${ms(niveles[i].p95)}</text>`)
    .join('\n')
  const marcaQuiebre = quiebre >= 0
    ? `<line class="umbral" x1="${x(quiebre)}" x2="${x(quiebre)}" y1="${M.arriba + 6}" y2="${y(niveles[quiebre].p95) - 26}" stroke-width="1" stroke-dasharray="2 3"/>
<text class="t2" x="${x(quiebre)}" y="${M.arriba}" font-size="11" text-anchor="middle">Punto de quiebre: ${miles(niveles[quiebre].usuarios)} usuarios</text>`
    : ''
  const cuerpo = `${grilla}
${lineaUmbral(y(UMBRAL), 'Umbral de un día normal: p95 < 800 ms', true)}
<path class="s1l" d="${linea}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
${puntos}
${etiquetas}
${marcaQuiebre}
${ejeX}
<text class="t3" x="${(ANCHO + M.izquierda) / 2}" y="${ALTO - 10}" font-size="11" text-anchor="middle">Usuarios registrando pedidos a la vez · 0 % de errores en todos los niveles</text>`
  const desc = niveles.map((n) => `${n.usuarios} usuarios: ${ms(n.p95)}`).join('; ') + `. Recuperación con 20 usuarios: ${recup.map(ms).join(' y ')}.`
  return marco('Estrés: tiempo de respuesta por nivel de usuarios', `p95 al registrar pedidos · recuperación con 20 usuarios: ${recup.map(ms).join(' y ')}`, cuerpo, desc)
}

function graficaEstresPeticiones(niveles) {
  const alto = ALTO - M.arriba - M.abajo
  const e = escala(Math.max(...niveles.map((n) => n.porSegundo)) * 1.1)
  const { y, svg: grilla } = ejeY(e, alto, (v) => miles(v))
  const paso = (ANCHO - M.izquierda - M.derecha) / niveles.length
  const anchoBarra = 24
  const maximo = niveles.reduce((m, n, i) => (n.porSegundo > niveles[m].porSegundo ? i : m), 0)
  const barras = niveles
    .map((n, i) => {
      const x0 = M.izquierda + paso * (i + 0.5) - anchoBarra / 2
      const etiqueta = i === maximo || i === niveles.length - 1
        ? `<text class="t1 num halo" x="${x0 + anchoBarra / 2}" y="${y(n.porSegundo) - 8}" font-size="11.5" font-weight="600" text-anchor="middle">${miles(n.porSegundo)}/s</text>`
        : ''
      return `${barra(x0, y(0), y(n.porSegundo), anchoBarra, 's1', `${miles(n.usuarios)} usuarios: ${miles(n.porSegundo)} peticiones por segundo`)}
${etiqueta}
<text class="t3 num" x="${x0 + anchoBarra / 2}" y="${M.arriba + alto + 18}" font-size="11" text-anchor="middle">${miles(n.usuarios)}</text>`
    })
    .join('\n')
  const cuerpo = `${grilla}
${barras}
<text class="t3" x="${(ANCHO + M.izquierda) / 2}" y="${ALTO - 10}" font-size="11" text-anchor="middle">Usuarios registrando pedidos a la vez · promedio de cada nivel de 1 minuto</text>`
  const desc = niveles.map((n) => `${n.usuarios} usuarios: ${miles(n.porSegundo)} por segundo`).join('; ')
  return marco('Estrés: peticiones atendidas por segundo', `Máximo de ${miles(niveles[maximo].porSegundo)}/s con ${miles(niveles[maximo].usuarios)} usuarios; con más usuarios el ritmo baja (saturación)`, cuerpo, desc)
}

function graficaVolumenConsultas() {
  const UMBRAL = 2000
  const datos = ESCENARIOS.map((s) => {
    const m = leer(s.consultas)
    return { ...s, pedidosP95: m['http_req_duration{name:listar_pedidos}']['p(95)'], rutasP95: m['http_req_duration{name:listar_rutas}']['p(95)'] }
  })
  const alto = ALTO - M.arriba - M.abajo
  const e = escala(Math.max(...datos.map((d) => d.rutasP95)) * 1.1)
  const { y, svg: grilla } = ejeY(e, alto, (v) => (v >= 1000 ? `${v / 1000} s` : `${v} ms`))
  const grupo = (ANCHO - M.izquierda - M.derecha) / datos.length
  const anchoBarra = 24
  const barras = datos
    .map((d, i) => {
      const centro = M.izquierda + grupo * (i + 0.5)
      const xP = centro - anchoBarra - 1
      const xR = centro + 1 // 2 px de separacion entre las barras del grupo
      return `${barra(xP, y(0), y(d.pedidosP95), anchoBarra, 's1', `${d.nombre}: listar pedidos p95 ${ms(d.pedidosP95)}`)}
${barra(xR, y(0), y(d.rutasP95), anchoBarra, 's2', `${d.nombre}: listar rutas p95 ${ms(d.rutasP95)} (${miles(d.rutas)} rutas)`)}
<text class="t1 num halo" x="${xR + 4}" y="${y(d.rutasP95) - 8}" font-size="11.5" font-weight="600" text-anchor="start">${ms(d.rutasP95)}</text>
<text class="t2 num halo" x="${xP + anchoBarra - 4}" y="${y(d.pedidosP95) - 8}" font-size="11" text-anchor="end">${ms(d.pedidosP95)}</text>
<text class="t3" x="${centro}" y="${M.arriba + alto + 18}" font-size="11" text-anchor="middle">${esc(d.nombre)}</text>
<text class="t3 num" x="${centro}" y="${M.arriba + alto + 32}" font-size="10.5" text-anchor="middle">${miles(d.pedidos)} pedidos · ${miles(d.rutas)} rutas</text>`
    })
    .join('\n')
  const leyenda = `<rect class="s1" x="${M.izquierda}" y="58" width="10" height="10" rx="2"/><text class="t2" x="${M.izquierda + 15}" y="67" font-size="11.5">Listar pedidos de la fecha</text>
<rect class="s2" x="${M.izquierda + 180}" y="58" width="10" height="10" rx="2"/><text class="t2" x="${M.izquierda + 195}" y="67" font-size="11.5">Listar rutas de la fecha</text>`
  const cuerpo = `${grilla}
${lineaUmbral(y(UMBRAL), 'Umbral: p95 < 2 s')}
${barras}
${leyenda}`
  const desc = datos.map((d) => `${d.nombre}: pedidos ${ms(d.pedidosP95)}, rutas ${ms(d.rutasP95)}`).join('; ')
  return marco('Volumen: consultas con la base llena', 'p95 con 10 usuarios consultando a la vez', cuerpo, desc).replace(`<text class="t2" x="${M.izquierda}" y="50" font-size="12.5">p95 con 10 usuarios consultando a la vez</text>`, `<text class="t2" x="${M.izquierda}" y="46" font-size="12.5">p95 con 10 usuarios consultando a la vez</text>`)
}

function graficaVolumenArmado() {
  const datos = ESCENARIOS.map((s) => ({ ...s, ms: leer(s.armado)['http_req_duration{name:armar_rutas}'].avg }))
  const alto = ALTO - M.arriba - M.abajo
  const e = escala(Math.max(...datos.map((d) => d.ms / 1000)) * 1.15)
  const { y, svg: grilla } = ejeY(e, alto, (v) => `${v} s`)
  const grupo = (ANCHO - M.izquierda - M.derecha) / datos.length
  const anchoBarra = 24
  const barras = datos
    .map((d, i) => {
      const centro = M.izquierda + grupo * (i + 0.5)
      const x0 = centro - anchoBarra / 2
      return `${barra(x0, y(0), y(d.ms / 1000), anchoBarra, 's1', `${d.nombre}: ${miles(d.pedidos)} pedidos en ${miles(d.rutas)} rutas, ${ms(d.ms)}`)}
<text class="t1 num halo" x="${centro}" y="${y(d.ms / 1000) - 8}" font-size="11.5" font-weight="600" text-anchor="middle">${ms(d.ms)}</text>
<text class="t3" x="${centro}" y="${M.arriba + alto + 18}" font-size="11" text-anchor="middle">${esc(d.nombre)}</text>
<text class="t3 num" x="${centro}" y="${M.arriba + alto + 32}" font-size="10.5" text-anchor="middle">${miles(d.pedidos)} pedidos → ${miles(d.rutas)} rutas</text>`
    })
    .join('\n')
  const desc = datos.map((d) => `${d.nombre}: ${ms(d.ms)}`).join('; ')
  return marco('Volumen: tiempo de armado de rutas de una fecha', 'POST /api/rutas/armar con la base llena · ninguna ruta supera 4 pedidos', `${grilla}\n${barras}`, desc)
}

fs.mkdirSync(SALIDA, { recursive: true })
const niveles = nivelesEstres()
const archivos = {
  'estres-p95.svg': graficaEstresP95(niveles, recuperacion()),
  'estres-peticiones.svg': graficaEstresPeticiones(niveles),
  'volumen-consultas.svg': graficaVolumenConsultas(),
  'volumen-armado.svg': graficaVolumenArmado(),
}
for (const [nombre, svg] of Object.entries(archivos)) {
  fs.writeFileSync(path.join(SALIDA, nombre), svg)
  console.log(`  ${path.relative(RAIZ, path.join(SALIDA, nombre))}`)
}
