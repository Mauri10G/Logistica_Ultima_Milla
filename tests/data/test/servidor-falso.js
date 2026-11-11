const http = require('node:http')

/**
 * Levanta un servidor HTTP local en un puerto libre. Guarda cada peticion recibida en `peticiones` y responde
 * lo que devuelva `manejador({ metodo, ruta, cabeceras, cuerpo })`: un objeto { estado, cuerpo }.
 */
function iniciarServidor(manejador) {
  const peticiones = []
  const servidor = http.createServer((req, res) => {
    let texto = ''
    req.on('data', (parte) => (texto += parte))
    req.on('end', () => {
      const peticion = {
        metodo: req.method,
        ruta: req.url,
        cabeceras: req.headers,
        cuerpo: texto ? JSON.parse(texto) : null,
      }
      peticiones.push(peticion)
      const { estado, cuerpo } = manejador(peticion)
      res.writeHead(estado, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(cuerpo ?? null))
    })
  })
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${servidor.address().port}`,
        peticiones,
        cerrar: () => new Promise((listo) => servidor.close(listo)),
      })
    })
  })
}

module.exports = { iniciarServidor }
