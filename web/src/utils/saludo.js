/**
 * Saludo según la hora del dispositivo (es solo cortesía de la pantalla de login; las validaciones de hora de
 * pedidos siguen usando la del servidor). De 05:00 a 11:59 "Buenos días", de 12:00 a 18:59 "Buenas tardes" y el
 * resto "Buenas noches".
 */
export function saludoSegunHora(fecha = new Date()) {
  const hora = fecha.getHours()
  if (hora >= 5 && hora < 12) return 'Buenos días'
  if (hora >= 12 && hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
