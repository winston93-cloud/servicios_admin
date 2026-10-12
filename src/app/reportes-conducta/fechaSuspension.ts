const TZ = 'America/Mexico_City'

function isoEnMexico(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Siguiente día lunes–viernes a partir de mañana (hora de México). */
export function siguienteDiaHabil(): string {
  const [y, m, d] = isoEnMexico(new Date()).split('-').map(Number)
  const f = new Date(Date.UTC(y, m - 1, d))
  do {
    f.setUTCDate(f.getUTCDate() + 1)
  } while (f.getUTCDay() === 0 || f.getUTCDay() === 6)
  return f.toISOString().slice(0, 10)
}

/** «miércoles 14 de octubre de 2026» a partir de AAAA-MM-DD. */
export function fechaLargaEs(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
