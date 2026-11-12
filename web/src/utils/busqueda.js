/** Minúsculas y sin acentos, para que "bolivar" encuentre "Bolívar". */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** true si `busqueda` está en alguno de los `campos` (una búsqueda vacía coincide con todo). */
export function coincide(busqueda, ...campos) {
  const buscado = normalizar(busqueda)
  if (!buscado) return true
  return campos.some((campo) => normalizar(campo).includes(buscado))
}
