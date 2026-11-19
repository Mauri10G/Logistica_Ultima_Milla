const NOMBRES = ['Carlos', 'Luis', 'Andrea', 'Diego', 'Paola', 'Marco', 'Gabriela', 'Fernando', 'Veronica', 'Santiago']
const APELLIDOS = ['Mena', 'Salazar', 'Naranjo', 'Vargas', 'Cevallos', 'Villacis', 'Freire', 'Mora', 'Ramos', 'Pazmino']

/** Clave que llevan todos los repartidores de prueba (solo para pruebas de volumen y carga, nunca en produccion). */
const CLAVE_DE_PRUEBA = 'repartidor123'

/** Repartidor numero `indice` (1, 2, 3...). Siempre devuelve lo mismo para el mismo indice, con su usuario y clave. */
function repartidorDePrueba(indice) {
  const nombre = NOMBRES[indice % NOMBRES.length]
  const apellido = APELLIDOS[Math.floor(indice / NOMBRES.length) % APELLIDOS.length]
  return {
    nombres: `${nombre} ${apellido} (R${String(indice).padStart(3, '0')})`,
    telefono: `0995${String(indice).padStart(6, '0')}`,
    usuario: `rep${String(indice).padStart(4, '0')}`,
    clave: CLAVE_DE_PRUEBA,
    capacidadMaxima: 4,
    disponible: true,
  }
}

/**
 * Deja al menos `total` repartidores disponibles: cuenta los que ya existen y crea solo los que faltan,
 * asi el generador se puede ejecutar varias veces sin duplicarlos. Si el usuario de un indice ya lo tiene un
 * repartidor dado de baja (409), salta al siguiente indice.
 */
async function asegurarRepartidores(api, total, cabeceras) {
  const respuesta = await fetch(`${api}/api/repartidores`, { headers: cabeceras })
  if (!respuesta.ok) throw new Error(`No se pudieron leer los repartidores: HTTP ${respuesta.status}`)
  const actuales = await respuesta.json()
  const existentes = actuales.filter((r) => r.disponible).length

  let creados = 0
  for (let indice = actuales.length + 1; existentes + creados < total; indice++) {
    const alta = await fetch(`${api}/api/repartidores`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(repartidorDePrueba(indice)),
    })
    if (alta.status === 409) continue
    if (alta.status !== 201) {
      throw new Error(`No se pudo crear el repartidor ${indice}: HTTP ${alta.status} ${(await alta.text()).slice(0, 120)}`)
    }
    creados++
  }
  return { existentes, creados }
}

module.exports = { repartidorDePrueba, asegurarRepartidores }
