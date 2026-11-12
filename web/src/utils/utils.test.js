import { fechaIso } from '../hooks/fechas'
import {
  codigoDeError,
  endpointNoDisponible,
  estadoHttp,
  MENSAJE_FUNCION_NO_DISPONIBLE,
  mensajeDeError,
  mensajeDeErrorPedido,
} from './errores'
import { ESTADOS_PEDIDO } from './estados'
import { formatearFechaHora } from './formatos'
import { poligonoAPuntos, puntosAPoligono } from './geojson'
import { claveDeZona } from './zonas'
import { crearIconoParada, paradasOrdenadas } from './paradas'
import {
  fechaPorDefecto,
  horaHHmm,
  horaMinimaEntrega,
  horaServidorValida,
  MENSAJE_FECHA_PASADA,
  MENSAJE_SIN_UBICACION,
  mensajeHoraInvalida,
  validarEntrega,
  validarPedido,
} from './validacionPedido'

function errorHttp(status, datos) {
  return { response: { status, data: datos } }
}

describe('errores', () => {
  test('mensajeDeError usa el mensaje de la API', () => {
    expect(mensajeDeError(errorHttp(409, { mensaje: 'Pedido no editable' }))).toBe('Pedido no editable')
  })

  test('mensajeDeError agrega el detalle de los campos inválidos', () => {
    const error = errorHttp(400, {
      mensaje: 'Hay campos invalidos',
      errores: { direccion: 'obligatoria', latitud: 'fuera de rango' },
    })
    expect(mensajeDeError(error)).toBe('Hay campos invalidos (direccion: obligatoria; latitud: fuera de rango)')
  })

  test('mensajeDeError explica un error de red', () => {
    expect(mensajeDeError({ code: 'ERR_NETWORK', message: 'Network Error' })).toMatch(/No se pudo conectar/)
    expect(mensajeDeError({ request: {}, message: 'x' })).toMatch(/No se pudo conectar/)
  })

  test('mensajeDeError cae al mensaje del error o a uno por defecto', () => {
    expect(mensajeDeError(new Error('falló'))).toBe('falló')
    expect(mensajeDeError(undefined)).toBe('Error desconocido')
  })

  test('estadoHttp y codigoDeError leen la respuesta', () => {
    const error = errorHttp(422, { codigo: 'FECHA_ENTREGA_PASADA' })
    expect(estadoHttp(error)).toBe(422)
    expect(codigoDeError(error)).toBe('FECHA_ENTREGA_PASADA')
    expect(estadoHttp(new Error('sin respuesta'))).toBeUndefined()
  })

  test('endpointNoDisponible: 405 y 404 del enrutador sí; 404 de un recurso o otros códigos no', () => {
    expect(endpointNoDisponible(errorHttp(405, {}))).toBe(true)
    expect(endpointNoDisponible(errorHttp(404, { codigo: 'NOT_FOUND' }))).toBe(true)
    expect(endpointNoDisponible(errorHttp(404, undefined))).toBe(true)
    expect(endpointNoDisponible(errorHttp(404, { codigo: 'RECURSO_NO_ENCONTRADO' }))).toBe(false)
    expect(endpointNoDisponible(errorHttp(409, { codigo: 'ESTADO_ILEGAL' }))).toBe(false)
    expect(MENSAJE_FUNCION_NO_DISPONIBLE).toBe('Función disponible cuando el backend la publique')
  })

  test('mensajeDeErrorPedido explica CP-03, CP-04 y CP-05', () => {
    expect(mensajeDeErrorPedido(errorHttp(422, { codigo: 'DIRECCION_FUERA_DE_ZONA' }))).toMatch(
      /no corresponde a ninguna zona configurada/,
    )
    expect(mensajeDeErrorPedido(errorHttp(422, { codigo: 'FECHA_ENTREGA_PASADA' }))).toMatch(
      /no puede ser anterior a hoy/,
    )
    expect(mensajeDeErrorPedido(errorHttp(409, { codigo: 'PEDIDO_NO_EDITABLE' }))).toMatch(/ya no se puede modificar/)
    // 422 por hora de entrega: se muestra tal cual el mensaje del backend, que trae la hora del servidor
    expect(mensajeDeErrorPedido(errorHttp(422, { codigo: 'HORA_ENTREGA_INVALIDA', mensaje: MENSAJE_HORA }))).toBe(
      MENSAJE_HORA,
    )
    expect(mensajeDeErrorPedido(errorHttp(500, { mensaje: 'Ocurrio un error interno' }))).toBe(
      'Ocurrio un error interno',
    )
  })
})

describe('geojson', () => {
  const puntos = [
    [-1.25, -78.62],
    [-1.25, -78.6],
    [-1.27, -78.6],
  ]

  test('puntosAPoligono invierte a [lng, lat] y cierra el anillo', () => {
    const area = puntosAPoligono(puntos)
    expect(area.type).toBe('Polygon')
    expect(area.coordinates[0]).toEqual([
      [-78.62, -1.25],
      [-78.6, -1.25],
      [-78.6, -1.27],
      [-78.62, -1.25],
    ])
  })

  test('poligonoAPuntos es la inversa y quita el punto de cierre', () => {
    expect(poligonoAPuntos(puntosAPoligono(puntos))).toEqual(puntos)
  })

  test('poligonoAPuntos tolera áreas vacías', () => {
    expect(poligonoAPuntos(undefined)).toEqual([])
    expect(poligonoAPuntos({ coordinates: [[]] })).toEqual([])
  })
})

// Respuesta simulada de GET /api/servidor/hora (19:15 del servidor, 30 minutos de anticipación)
const HORA_SERVIDOR = {
  fecha: '2031-05-17',
  hora: '19:15:00',
  zonaHoraria: 'America/Guayaquil',
  anticipacionMinimaMinutos: 30,
  entregaMinimaFecha: '2031-05-17',
  entregaMinimaHora: '19:45:00',
}
const MENSAJE_HORA = 'La hora de entrega debe ser al menos 30 minutos después de la hora actual del servidor, 19:15'

describe('validarPedido', () => {
  const valido = { fechaEntrega: '2031-05-18', horaEntrega: '09:00', latitud: '-1.24', longitud: '-78.6' }

  test('acepta un pedido con fecha futura y ubicación', () => {
    expect(validarPedido(valido, HORA_SERVIDOR)).toEqual({})
  })

  test('acepta la fecha de hoy con una hora válida', () => {
    expect(validarPedido({ ...valido, fechaEntrega: '2031-05-17', horaEntrega: '19:45' }, HORA_SERVIDOR)).toEqual({})
  })

  test('rechaza una fecha pasada (CP-04)', () => {
    expect(validarPedido({ ...valido, fechaEntrega: '2031-05-16' }, HORA_SERVIDOR).fechaEntrega).toBe(
      MENSAJE_FECHA_PASADA,
    )
  })

  test('rechaza hoy con una hora pasada o dentro de la anticipación, con el mensaje del servidor', () => {
    const hoy = { ...valido, fechaEntrega: '2031-05-17' }
    expect(validarPedido({ ...hoy, horaEntrega: '07:00' }, HORA_SERVIDOR).horaEntrega).toBe(MENSAJE_HORA)
    expect(validarPedido({ ...hoy, horaEntrega: '19:44' }, HORA_SERVIDOR).horaEntrega).toBe(MENSAJE_HORA)
  })

  test('mañana acepta cualquier hora', () => {
    for (const horaEntrega of ['00:00', '07:00', '23:59']) {
      expect(validarPedido({ ...valido, horaEntrega }, HORA_SERVIDOR)).toEqual({})
    }
  })

  test('una fecha pasada solo se reporta como fecha, no también como hora', () => {
    const errores = validarPedido({ ...valido, fechaEntrega: '2031-05-16', horaEntrega: '07:00' }, HORA_SERVIDOR)
    expect(Object.keys(errores)).toEqual(['fechaEntrega'])
  })

  test('rechaza un pedido sin ubicación', () => {
    expect(validarPedido({ ...valido, latitud: '' }, HORA_SERVIDOR).ubicacion).toBe(MENSAJE_SIN_UBICACION)
    expect(validarPedido({ ...valido, longitud: '' }, HORA_SERVIDOR).ubicacion).toBe(MENSAJE_SIN_UBICACION)
  })

  test('sin la hora del servidor no valida fecha ni hora: lo hace el backend', () => {
    const pasado = { ...valido, fechaEntrega: '2001-01-01', horaEntrega: '00:00' }
    expect(validarPedido(pasado)).toEqual({})
    expect(validarPedido(pasado, null)).toEqual({})
    expect(validarPedido({ ...pasado, latitud: '' }).ubicacion).toBe(MENSAJE_SIN_UBICACION)
  })
})

describe('validación de la entrega con la hora del servidor', () => {
  test('horaHHmm quita los segundos', () => {
    expect(horaHHmm('19:15:00')).toBe('19:15')
    expect(horaHHmm('19:15')).toBe('19:15')
    expect(horaHHmm(undefined)).toBe('')
  })

  test('horaServidorValida exige fecha, hora y la primera entrega aceptada', () => {
    expect(horaServidorValida(HORA_SERVIDOR)).toBe(true)
    expect(horaServidorValida(null)).toBe(false)
    expect(horaServidorValida({})).toBe(false)
    expect(horaServidorValida({ fecha: '2031-05-17', hora: '19:15:00' })).toBe(false)
  })

  test('fechaPorDefecto usa la del servidor y, sin ella, la del computador solo como valor inicial', () => {
    expect(fechaPorDefecto(HORA_SERVIDOR)).toBe('2031-05-17')
    expect(fechaPorDefecto({ ...HORA_SERVIDOR, entregaMinimaFecha: '2031-05-18' })).toBe('2031-05-18')
    expect(fechaPorDefecto(null)).toBe(fechaIso(0))
  })

  test('horaMinimaEntrega solo aplica a la primera fecha con entregas posibles', () => {
    expect(horaMinimaEntrega('2031-05-17', HORA_SERVIDOR)).toBe('19:45')
    expect(horaMinimaEntrega('2031-05-18', HORA_SERVIDOR)).toBeUndefined()
    expect(horaMinimaEntrega('2031-05-17', null)).toBeUndefined()
  })

  test('mensajeHoraInvalida usa la anticipación y la hora del servidor', () => {
    expect(mensajeHoraInvalida(HORA_SERVIDOR)).toBe(MENSAJE_HORA)
    expect(mensajeHoraInvalida({ ...HORA_SERVIDOR, anticipacionMinimaMinutos: 45, hora: '08:05:00' })).toBe(
      'La hora de entrega debe ser al menos 45 minutos después de la hora actual del servidor, 08:05',
    )
  })

  test('validarEntrega: sin hora elegida no marca la hora; cerca de la medianoche hoy ya no tiene horas válidas', () => {
    expect(validarEntrega('2031-05-17', '', HORA_SERVIDOR)).toEqual({})
    const casiMedianoche = {
      ...HORA_SERVIDOR,
      hora: '23:50:00',
      entregaMinimaFecha: '2031-05-18',
      entregaMinimaHora: '00:20:00',
    }
    expect(validarEntrega('2031-05-17', '23:55', casiMedianoche).horaEntrega).toMatch(/hora actual del servidor, 23:50/)
    expect(validarEntrega('2031-05-18', '00:20', casiMedianoche)).toEqual({})
    expect(validarEntrega('2031-05-18', '00:19', casiMedianoche).horaEntrega).toBeDefined()
  })
})

describe('fechas, formatos y estados', () => {
  test('fechaIso devuelve YYYY-MM-DD y desplaza días', () => {
    expect(fechaIso(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(fechaIso(1) > fechaIso(0)).toBe(true)
    expect(fechaIso(-1) < fechaIso(0)).toBe(true)
  })

  test('formatearFechaHora', () => {
    expect(formatearFechaHora('2026-02-13T09:30:15.123456')).toBe('2026-02-13 09:30:15')
    expect(formatearFechaHora(null)).toBe('')
  })

  test('ESTADOS_PEDIDO sigue el orden lineal', () => {
    expect(ESTADOS_PEDIDO).toEqual(['PENDIENTE', 'ASIGNADO', 'RECOGIDO', 'EN_CAMINO', 'ENTREGADO'])
  })
})

describe('paradas', () => {
  test('paradasOrdenadas respeta ordenEnRuta', () => {
    const ruta = { pedidos: [{ id: 1, ordenEnRuta: 2 }, { id: 2, ordenEnRuta: 1 }] }
    expect(paradasOrdenadas(ruta).map((p) => p.pedido.id)).toEqual([2, 1])
  })

  test('paradasOrdenadas usa el orden de la lista si falta ordenEnRuta', () => {
    const ruta = { pedidos: [{ id: 5 }, { id: 6 }] }
    expect(paradasOrdenadas(ruta).map((p) => p.pedido.id)).toEqual([5, 6])
  })

  test('crearIconoParada muestra el número con el color de la ruta', () => {
    const icono = crearIconoParada(3, '#16a34a')
    expect(icono.options.html).toContain('>3<')
    expect(icono.options.html).toContain('#16a34a')
  })

  test('crearIconoParada con estado deja el relleno al color de ese estado y el aro al de la ruta', () => {
    const icono = crearIconoParada(2, '#16a34a', 'EN_CAMINO')
    expect(icono.options.html).toContain('class="parada-EN_CAMINO"')
    expect(icono.options.html).toContain('--ruta:#16a34a')
  })

  test('crearIconoParada sin estado no agrega clase de estado', () => {
    expect(crearIconoParada(1, '#2563eb').options.html).not.toContain('class=')
  })
})

describe('claveDeZona', () => {
  const zona = { id: 1, nombre: 'Centro', activa: true, area: { coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }

  test('es estable si la zona no cambia', () => {
    expect(claveDeZona({ ...zona })).toBe(claveDeZona(zona))
  })

  test('cambia si cambia el polígono, el nombre o el estado', () => {
    const base = claveDeZona(zona)
    expect(claveDeZona({ ...zona, area: { coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] } })).not.toBe(base)
    expect(claveDeZona({ ...zona, nombre: 'Otro' })).not.toBe(base)
    expect(claveDeZona({ ...zona, activa: false })).not.toBe(base)
  })

  test('tolera una zona sin área', () => {
    expect(claveDeZona({ id: 2, nombre: 'Vacía', activa: true })).toContain('2:Vacía')
  })
})
