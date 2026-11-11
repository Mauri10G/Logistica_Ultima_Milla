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
import { MENSAJE_FECHA_PASADA, MENSAJE_SIN_UBICACION, validarPedido } from './validacionPedido'

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

describe('validarPedido', () => {
  const valido = { fechaEntrega: fechaIso(1), latitud: '-1.24', longitud: '-78.6' }

  test('acepta un pedido con fecha futura y ubicación', () => {
    expect(validarPedido(valido)).toEqual({})
  })

  test('acepta la fecha de hoy', () => {
    expect(validarPedido({ ...valido, fechaEntrega: fechaIso(0) })).toEqual({})
  })

  test('rechaza una fecha pasada (CP-04)', () => {
    expect(validarPedido({ ...valido, fechaEntrega: fechaIso(-1) }).fechaEntrega).toBe(MENSAJE_FECHA_PASADA)
  })

  test('rechaza un pedido sin ubicación', () => {
    expect(validarPedido({ ...valido, latitud: '' }).ubicacion).toBe(MENSAJE_SIN_UBICACION)
    expect(validarPedido({ ...valido, longitud: '' }).ubicacion).toBe(MENSAJE_SIN_UBICACION)
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
