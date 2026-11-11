// Unico archivo que lee import.meta.env (Jest lo reemplaza por src/__mocks__/entorno.js).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/** Con false (por defecto) la web funciona sin login; con true exige iniciar sesion. */
export const AUTH_HABILITADA = import.meta.env.VITE_AUTH_HABILITADA === 'true'
