import { resolverUrlApi } from './urlApi'

describe('resolverUrlApi', () => {
  const origen = 'http://192.168.1.20:8080'

  test('sin valor usa el backend de desarrollo', () => {
    expect(resolverUrlApi(undefined, origen)).toBe('http://localhost:8080')
  })

  test('mismo-origen usa el host que sirve la web', () => {
    expect(resolverUrlApi('mismo-origen', 'https://logistica.example.com')).toBe('https://logistica.example.com')
  })

  test('una ruta relativa se arma sobre el mismo host', () => {
    expect(resolverUrlApi('/logistica', origen)).toBe('http://192.168.1.20:8080/logistica')
  })

  test('quita la barra final de la ruta', () => {
    expect(resolverUrlApi('/logistica/', origen)).toBe('http://192.168.1.20:8080/logistica')
  })

  test('una URL completa se usa tal cual', () => {
    expect(resolverUrlApi('http://localhost:9090', origen)).toBe('http://localhost:9090')
  })
})
