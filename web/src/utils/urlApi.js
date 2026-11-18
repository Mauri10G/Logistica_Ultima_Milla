/**
 * Arma la URL base del backend a partir de VITE_API_URL.
 * - Sin valor: http://localhost:8080, el backend de desarrollo.
 * - mismo-origen: el mismo host que sirve la web. Lo usan Docker, Kubernetes y la nube, con un proxy delante.
 * - Una ruta como /logistica: el mismo host mas ese contexto. Lo usa Tomcat, donde el WAR queda en /logistica.
 * - Cualquier otra URL se usa tal cual.
 */
export function resolverUrlApi(urlConfigurada, origen) {
  if (!urlConfigurada) return 'http://localhost:8080'
  if (urlConfigurada === 'mismo-origen') return origen
  if (urlConfigurada.startsWith('/')) return origen + urlConfigurada.replace(/\/+$/, '')
  return urlConfigurada
}
