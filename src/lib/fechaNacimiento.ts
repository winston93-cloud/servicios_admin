/** Normaliza valor de BD (DATE o timestamp) a YYYY-MM-DD. */
export function fechaNacIsoDesdeBd(valor: string | null | undefined): string {
  if (!valor) return ''
  const solo = String(valor).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(solo)) return ''
  const d = new Date(`${solo}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return solo
}

/** Muestra DD/MM/AAAA para el input de texto. */
export function fechaNacAMostrar(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

/** Interpreta DD/MM/AAAA o YYYY-MM-DD → ISO o null si inválida. */
export function fechaNacDesdeTexto(texto: string): string | null {
  const t = texto.trim()
  if (!t) return ''

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    return fechaNacEsValida(iso[0]) ? iso[0] : null
  }

  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!dmy) return null

  const dia = dmy[1].padStart(2, '0')
  const mes = dmy[2].padStart(2, '0')
  const anio = dmy[3]
  const candidata = `${anio}-${mes}-${dia}`
  return fechaNacEsValida(candidata) ? candidata : null
}

export function fechaNacEsValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const [y, m, day] = iso.split('-').map(Number)
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day
}
