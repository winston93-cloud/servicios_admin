/** Catálogo English Preschool / Kinder Inglés (legacy boletasik). Indicadores en `boleta_kinder_en_indicador`. */

export type KinderEnGrado = 0 | 1 | 2 | 3

export type KinderEnTipo = 'subject' | 'behavioral' | 'maternal'

export type KinderEnFormato = 'escala' | 'numero'

export type KinderEnIndicador = {
  /** Coincide con `indicador_id` en su tabla de calificaciones (fk_materia legacy). */
  id: number
  tipo: KinderEnTipo
  grado: KinderEnGrado
  nombre: string
  orden: number
  formato: KinderEnFormato
  /** Solo subjects: cuenta para el Average (Music / Mindfulness no). */
  enPromedio: boolean
  activo: boolean
}

/** Nivel alumno Winston: 1 = Maternal, 2 = Kinder */
export const BOLETAS_NIVEL_MATERNAL = 1
export const BOLETAS_NIVEL_KINDER = 2

export const KINDER_EN_GRADOS: { valor: KinderEnGrado; etiqueta: string }[] = [
  { valor: 0, etiqueta: 'Maternal' },
  { valor: 1, etiqueta: 'K1' },
  { valor: 2, etiqueta: 'K2' },
  { valor: 3, etiqueta: 'K3' },
]

export const KINDER_EN_GRUPOS = ['A', 'B', 'C', 'D'] as const

/** Maternal: el grupo es `alumno_grado` (Maternal A = 1, Maternal B = 2). */
export const KINDER_EN_GRUPOS_MATERNAL = ['A', 'B'] as const

export const KINDER_EN_ESCALA_NOTA: { letra: string; valor: number; etiqueta: string }[] = [
  { letra: 'E', valor: 10, etiqueta: 'Excellent' },
  { letra: 'VG', valor: 9, etiqueta: 'Very good' },
  { letra: 'G', valor: 8, etiqueta: 'Good' },
  { letra: 'R', valor: 7, etiqueta: 'Regular' },
  { letra: 'S', valor: 6, etiqueta: 'Sufficient' },
  { letra: 'NI', valor: 5, etiqueta: 'Needs improvement' },
]

export const KINDER_EN_ESCALA_LETRAS = KINDER_EN_ESCALA_NOTA.map((e) => e.letra)

export const KINDER_EN_ESCALA_HINT = 'E=10 · VG=9 · G=8 · R=7 · S=6 · NI=5'

/** Máximo de días para School days / Days absent. */
export const KINDER_EN_DIAS_MAX = 120

export const ETIQUETA_TIPO_KINDER_EN: Record<KinderEnTipo, string> = {
  subject: 'Subjects',
  behavioral: 'Behavioral skills',
  maternal: 'Maternal',
}

export function etiquetaGradoKinderEn(grado: number): string {
  return KINDER_EN_GRADOS.find((g) => g.valor === grado)?.etiqueta ?? `K${grado}`
}

export function etiquetaGrupoKinderEn(grado: number, grupo: string): string {
  return `${etiquetaGradoKinderEn(grado)} ${grupo}`
}

export function esGradoKinderEn(n: unknown): n is KinderEnGrado {
  return n === 0 || n === 1 || n === 2 || n === 3
}

export function esMaternal(grado: KinderEnGrado): boolean {
  return grado === 0
}

/** '' si está vacía, la letra normalizada si es válida, null si no es de la escala. */
export function normalizarCalificacionEscala(raw: unknown): string | null {
  const v = String(raw ?? '').trim().toUpperCase()
  if (!v) return ''
  return KINDER_EN_ESCALA_LETRAS.includes(v) ? v : null
}

/** '' si está vacío, el número como texto si es entero 0..max, null si no. */
export function normalizarDias(raw: unknown, max = KINDER_EN_DIAS_MAX): string | null {
  const v = String(raw ?? '').trim()
  if (!v) return ''
  if (!/^\d{1,3}$/.test(v)) return null
  const n = Number(v)
  return n <= max ? String(n) : null
}

export function grupoNumeroDesdeLetra(letra: string): number {
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
  return map[letra.toUpperCase()] ?? 0
}

export function letraDesdeGrupoNumero(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' } as Record<number, string>)[n] ?? String(n)
}

export function calificacionLetraANumero(cal: string): number {
  const c = cal.trim().toUpperCase()
  const map: Record<string, number> = { E: 10, VG: 9, G: 8, R: 7, S: 6, NI: 5 }
  if (c in map) return map[c]
  const n = Number(c)
  return Number.isFinite(n) ? n : 0
}

export function promedioNumeroALetra(numero: number): string {
  if (!Number.isFinite(numero) || numero < 5 || numero > 10) return ''
  const entero = Math.round(numero)
  const map: Record<number, string> = { 10: 'E', 9: 'VG', 8: 'G', 7: 'R', 6: 'S', 5: 'NI' }
  return map[entero] ?? ''
}
