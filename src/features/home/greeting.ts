/**
 * Saludo según la hora local del navegador (§6.18): 6-12 mañana, 12-20 tarde,
 * el resto noche. Lógica pura, extraída para testearla (§9) sin montar la página.
 */
export function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour >= 6 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
