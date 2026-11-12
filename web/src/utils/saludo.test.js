import { saludoSegunHora } from './saludo'

const a = (hora, minuto = 0) => new Date(2026, 10, 12, hora, minuto)

describe('saludoSegunHora', () => {
  test.each([
    [5, 0, 'Buenos días'],
    [9, 30, 'Buenos días'],
    [11, 59, 'Buenos días'],
    [12, 0, 'Buenas tardes'],
    [15, 0, 'Buenas tardes'],
    [18, 59, 'Buenas tardes'],
    [19, 0, 'Buenas noches'],
    [23, 59, 'Buenas noches'],
    [0, 0, 'Buenas noches'],
    [4, 59, 'Buenas noches'],
  ])('a las %i:%i dice "%s"', (hora, minuto, esperado) => {
    expect(saludoSegunHora(a(hora, minuto))).toBe(esperado)
  })

  test('sin argumento usa la hora actual', () => {
    expect(['Buenos días', 'Buenas tardes', 'Buenas noches']).toContain(saludoSegunHora())
  })
})
