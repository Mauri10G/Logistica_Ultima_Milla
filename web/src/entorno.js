// Unico archivo que lee import.meta.env (Jest lo reemplaza por src/__mocks__/entorno.js).
// VITE_API_URL=mismo-origen se usa en Docker y Kubernetes: la web llama al mismo host que la sirve
// y Nginx reenvia /api y /ws al backend. Asi la misma imagen sirve en cualquier puerto.
const urlConfigurada = import.meta.env.VITE_API_URL
export const API_URL =
  urlConfigurada === 'mismo-origen' ? window.location.origin : urlConfigurada || 'http://localhost:8080'

/** Con true la web exige iniciar sesion (.env.example lo trae en true); sin la variable o con false funciona sin login. */
export const AUTH_HABILITADA = import.meta.env.VITE_AUTH_HABILITADA === 'true'
