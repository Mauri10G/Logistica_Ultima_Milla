import {
  bytesUtf8,
  errorDeNombres,
  errorDeTelefono,
  FORMATO_TELEFONO,
  LIMITES,
  MENSAJE_NOMBRE,
  MENSAJE_TELEFONO,
} from './camposFormulario'
import { CLAVE_MAX_BYTES, errorDeClave } from './credencialesRepartidor'

describe('límites de los formularios', () => {
  test('son los del backend', () => {
    expect(LIMITES).toEqual({
      clienteNombres: 150,
      clienteTelefono: 30,
      clienteEmail: 150,
      direccion: 255,
      zonaNombre: 100,
      repartidorNombres: 150,
      repartidorTelefono: 30,
    })
  })
})

describe('errorDeTelefono (misma regla que Formatos.TELEFONO del backend)', () => {
  test.each(['0991234567', '032821234', '+593 99 123 4567', '03-282-1234', '1234567', '123456789012345', '0991000001'])(
    '%s es válido',
    (telefono) => {
      expect(errorDeTelefono(telefono)).toBeNull()
      expect(FORMATO_TELEFONO.test(telefono)).toBe(true)
    },
  )

  test.each([
    'abc',
    '099abc4567',
    '123456',
    '1234567890123456',
    '+',
    '099 123 456 -',
    '-0991234567',
    '09912+34567',
    '0991234567 ext 2',
  ])('%s se rechaza', (telefono) => {
    expect(errorDeTelefono(telefono)).toBe(MENSAJE_TELEFONO)
  })

  test('ignora los espacios de los extremos', () => {
    expect(errorDeTelefono('  0991234567  ')).toBeNull()
  })

  test('vacío o ausente pide el dato', () => {
    expect(errorDeTelefono('')).toBe('El teléfono es obligatorio.')
    expect(errorDeTelefono('   ')).toBe('El teléfono es obligatorio.')
    expect(errorDeTelefono(undefined)).toBe('El teléfono es obligatorio.')
  })
})

describe('errorDeNombres (al menos una letra)', () => {
  test.each(['Maria Torres', 'Ángela Núñez', 'José Peña 2', "O'Brien", 'Ana-María', 'Cliente k6 1-2'])(
    '%s es válido',
    (nombres) => {
      expect(errorDeNombres(nombres)).toBeNull()
    },
  )

  test.each(['12345', '---', '123 456', '...'])('%s se rechaza', (nombres) => {
    expect(errorDeNombres(nombres)).toBe(MENSAJE_NOMBRE)
  })

  test('vacío o ausente pide el dato', () => {
    expect(errorDeNombres('')).toBe('El nombre es obligatorio.')
    expect(errorDeNombres(null)).toBe('El nombre es obligatorio.')
  })
})

describe('bytesUtf8 y contraseña del repartidor (72 bytes)', () => {
  test('una tilde o la ñ ocupan 2 bytes; una letra simple, 1', () => {
    expect(bytesUtf8('abc')).toBe(3)
    expect(bytesUtf8('é')).toBe(2)
    expect(bytesUtf8('ñ')).toBe(2)
    expect(bytesUtf8('')).toBe(0)
  })

  test('72 bytes se aceptan aunque sean 36 caracteres', () => {
    expect(CLAVE_MAX_BYTES).toBe(72)
    expect(errorDeClave('é'.repeat(36))).toBeNull()
    expect(errorDeClave('a'.repeat(72))).toBeNull()
  })

  test('73 bytes se rechazan aunque sean pocos caracteres', () => {
    expect(errorDeClave('a'.repeat(73))).toMatch(/72 bytes/)
    expect(errorDeClave(`${'é'.repeat(36)}a`)).toMatch(/72 bytes/)
    expect(errorDeClave('ñ'.repeat(37))).toMatch(/72 bytes/)
  })

  test('el mínimo sigue siendo de caracteres', () => {
    expect(errorDeClave('12345')).toBe('La contraseña debe tener al menos 6 caracteres.')
    expect(errorDeClave('123456')).toBeNull()
    expect(errorDeClave('')).toBe('La contraseña es obligatoria.')
  })
})
