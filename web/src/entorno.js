// Unico archivo que lee import.meta.env (Jest lo reemplaza por src/__mocks__/entorno.js).
// VITE_API_URL=mismo-origen se usa en Docker y Kubernetes: la web llama al mismo host que la sirve
// y Nginx reenvia /api y /ws al backend. En Tomcat se usa /logistica, el contexto del WAR. Ver utils/urlApi.js.
import { resolverUrlApi } from './utils/urlApi'

export const API_URL = resolverUrlApi(import.meta.env.VITE_API_URL, window.location.origin)

/** Con false (por defecto) la web funciona sin login; con true exige iniciar sesion. */
export const AUTH_HABILITADA = import.meta.env.VITE_AUTH_HABILITADA === 'true'
