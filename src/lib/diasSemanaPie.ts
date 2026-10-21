export const DIAS_SEMANA_PIE = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
] as const

export type DiaSemanaPie = (typeof DIAS_SEMANA_PIE)[number]['value']

export function normalizarDiaSemana(dia: string): DiaSemanaPie | null {
  const d = dia
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (DIAS_SEMANA_PIE.some((x) => x.value === d)) return d as DiaSemanaPie
  return null
}

export function diasSemanaNormalizados(dias: string[] | null | undefined): DiaSemanaPie[] {
  if (!dias?.length) return []
  const out: DiaSemanaPie[] = []
  for (const d of dias) {
    const n = normalizarDiaSemana(d)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

export function instanteMexico(): { iso: string; hora: number; dia: DiaSemanaPie | null } {
  const ahora = new Date()
  const iso = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const horaPart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(ahora)
    .find((p) => p.type === 'hour')?.value
  const hora = Number.parseInt(String(horaPart ?? ''), 10)
  const weekday = ahora.toLocaleDateString('es-MX', {
    weekday: 'long',
    timeZone: 'America/Mexico_City',
  })
  return {
    iso,
    hora: Number.isFinite(hora) ? hora : 0,
    dia: normalizarDiaSemana(weekday),
  }
}

/** SSIW: no se puede cambiar el día de hoy después de las 13:00 (hora México). */
export function bloqueadoDespuesDeLaUna(opts: { dia?: DiaSemanaPie; fecha?: string }): boolean {
  const m = instanteMexico()
  if (!(m.hora >= 13)) return false
  if (opts.fecha && opts.fecha === m.iso) return true
  if (opts.dia && m.dia != null && m.dia === opts.dia) return true
  return false
}
