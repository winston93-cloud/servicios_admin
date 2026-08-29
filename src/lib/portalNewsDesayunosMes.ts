/** Periodo calendario (mes natural) en zona horaria de México. */

export type PeriodoMes = {
  anio: number
  mes: number
}

export const MESES_ES: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: 'Enero' },
  { valor: 2, etiqueta: 'Febrero' },
  { valor: 3, etiqueta: 'Marzo' },
  { valor: 4, etiqueta: 'Abril' },
  { valor: 5, etiqueta: 'Mayo' },
  { valor: 6, etiqueta: 'Junio' },
  { valor: 7, etiqueta: 'Julio' },
  { valor: 8, etiqueta: 'Agosto' },
  { valor: 9, etiqueta: 'Septiembre' },
  { valor: 10, etiqueta: 'Octubre' },
  { valor: 11, etiqueta: 'Noviembre' },
  { valor: 12, etiqueta: 'Diciembre' },
]

export function periodoActualMx(): PeriodoMes {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const anio = Number(parts.find((p) => p.type === 'year')?.value)
  const mes = Number(parts.find((p) => p.type === 'month')?.value)
  return { anio, mes }
}

export function etiquetaMesAnio(anio: number, mes: number): string {
  const d = new Date(anio, mes - 1, 1)
  const mesNombre = d.toLocaleDateString('es-MX', { month: 'long' })
  return `${mesNombre.charAt(0).toUpperCase()}${mesNombre.slice(1)} ${anio}`
}

export function clavePeriodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`
}

export function parsearPeriodoMes(anio: unknown, mes: unknown): PeriodoMes | null {
  const a = Number(anio)
  const m = Number(mes)
  if (!Number.isFinite(a) || a < 2000 || a > 2100) return null
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return { anio: a, mes: m }
}
