export const NIVELES_TALLER = [
  { valor: 1, etiqueta: 'Maternal', corto: 'MAT' },
  { valor: 2, etiqueta: 'Kinder', corto: 'KIN' },
  { valor: 3, etiqueta: 'Primaria', corto: 'PRI' },
  { valor: 4, etiqueta: 'Secundaria', corto: 'SEC' },
] as const

export const DIAS_TALLER = [
  { valor: 1, etiqueta: 'Lunes', corto: 'L' },
  { valor: 2, etiqueta: 'Martes', corto: 'M' },
  { valor: 3, etiqueta: 'Miércoles', corto: 'X' },
  { valor: 4, etiqueta: 'Jueves', corto: 'J' },
  { valor: 5, etiqueta: 'Viernes', corto: 'V' },
  { valor: 6, etiqueta: 'Sábado', corto: 'S' },
] as const

export const COLORES_TALLER = [
  '#00e3fd',
  '#f5b942',
  '#ff6b8b',
  '#8b7bff',
  '#34d399',
  '#fb923c',
  '#60a5fa',
  '#e879f9',
] as const

export const CATEGORIAS_TALLER = ['Deportivo', 'Artístico', 'Concurso', 'Académico', 'Tecnológico'] as const

export type Taller = {
  id: number
  nombre: string
  grados: string | null
  categoria: string | null
  descripcion: string | null
  niveles: number[]
  color: string | null
  activo: boolean
}

export type TallerMaestro = {
  id: number
  nombre: string
  apellido_paterno: string | null
  apellido_materno: string | null
  email: string | null
  celular: string | null
  especialidad: string | null
  niveles: number[]
  notas: string | null
  activo: boolean
}

export type TallerHorario = {
  id?: number
  dia: number
  /** HH:MM (24 h) */
  hora_inicio: string
  hora_fin: string
  /** Solo si ese día cambia respecto a `TallerAsignacion.lugar`. */
  lugar?: string | null
}

export type TallerAsignacion = {
  id: number
  taller_id: number
  maestro_id: number
  ciclo_escolar: number
  niveles: number[]
  lugar: string | null
  cupo: number | null
  cupo_min: number | null
  notas: string | null
  activo: boolean
  horarios: TallerHorario[]
}

export function lugarDeHorario(a: Pick<TallerAsignacion, 'lugar'>, h: TallerHorario): string | null {
  const propio = (h.lugar ?? '').trim()
  return propio || (a.lugar ?? '').trim() || null
}

export function etiquetaCupo(a: Pick<TallerAsignacion, 'cupo' | 'cupo_min'>): string | null {
  if (a.cupo_min && a.cupo) return `${a.cupo_min} a ${a.cupo} alumnos`
  if (a.cupo) return `Máx. ${a.cupo}`
  if (a.cupo_min) return `Mín. ${a.cupo_min}`
  return null
}

export type TalleresSnapshot = {
  ciclo: { valor: number; nombre: string }
  talleres: Taller[]
  maestros: TallerMaestro[]
  asignaciones: TallerAsignacion[]
}

export function etiquetaNivel(n: number): string {
  return NIVELES_TALLER.find((x) => x.valor === n)?.etiqueta ?? `Nivel ${n}`
}

export function etiquetaDia(d: number): string {
  return DIAS_TALLER.find((x) => x.valor === d)?.etiqueta ?? `Día ${d}`
}

export function nombreMaestroTaller(m: Pick<TallerMaestro, 'nombre' | 'apellido_paterno' | 'apellido_materno'>): string {
  return [m.nombre, m.apellido_paterno, m.apellido_materno]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export function nombreTallerCompleto(t: Pick<Taller, 'nombre' | 'grados'>): string {
  const g = (t.grados ?? '').trim()
  return g ? `${t.nombre} ${g}` : t.nombre
}

/** Normaliza lista de niveles: solo 1..4, sin duplicados, ordenada. */
export function normalizarNiveles(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const set = new Set<number>()
  for (const v of raw) {
    const n = Number(v)
    if (NIVELES_TALLER.some((x) => x.valor === n)) set.add(n)
  }
  return [...set].sort((a, b) => a - b)
}

/** "15:00:00" | "15:00" → "15:00"; inválido → null. */
export function normalizarHora(raw: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** "15:00" → "3:00 PM" */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const sufijo = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export function rangosSeTraslapan(a: TallerHorario, b: TallerHorario): boolean {
  if (a.dia !== b.dia) return false
  return minutosDeHora(a.hora_inicio) < minutosDeHora(b.hora_fin) &&
    minutosDeHora(b.hora_inicio) < minutosDeHora(a.hora_fin)
}

/** "Lunes 3:00 PM – 4:00 PM · Miércoles …" */
export function resumenHorarios(horarios: TallerHorario[]): string {
  return [...horarios]
    .sort((a, b) => a.dia - b.dia || minutosDeHora(a.hora_inicio) - minutosDeHora(b.hora_inicio))
    .map((h) => `${etiquetaDia(h.dia)} ${hora12(h.hora_inicio)} – ${hora12(h.hora_fin)}`)
    .join(' · ')
}
