/**
 * Cabeceras para llamar a la API. Si existe la variable de entorno API_USUARIO se hace login en
 * POST /api/auth/login (clave en API_CLAVE) y se agrega el token Bearer; si no existe, la API se usa abierta
 * (logistica.seguridad.habilitada = false).
 */
async function obtenerCabeceras(api, entorno = process.env) {
  const cabeceras = { 'Content-Type': 'application/json' }
  if (!entorno.API_USUARIO) return cabeceras

  const respuesta = await fetch(`${api}/api/auth/login`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ usuario: entorno.API_USUARIO, clave: entorno.API_CLAVE ?? '' }),
  })
  if (!respuesta.ok) throw new Error(`Login fallido para ${entorno.API_USUARIO}: HTTP ${respuesta.status}`)
  const { token } = await respuesta.json()
  if (!token) throw new Error('El login no devolvio un token')
  return { ...cabeceras, Authorization: `Bearer ${token}` }
}

module.exports = { obtenerCabeceras }
