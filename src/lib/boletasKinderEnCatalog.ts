/** Catálogo English Preschool / Kinder Inglés (legacy boletasik). */

export type KinderEnGrado = 0 | 1 | 2 | 3

export type KinderEnIndicador = {
  /** Coincide con fk_materia legacy (subjects / behavioral / maternal en su tabla). */
  id: number
  grado: KinderEnGrado
  nombre: string
  orden: number
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

/** Escala EN: E=10, VG=9, G=8, R=7, S=6, NI=5 (sigue permitiendo texto libre). */
export const KINDER_EN_ESCALA_NOTA: { letra: string; valor: number }[] = [
  { letra: 'E', valor: 10 },
  { letra: 'VG', valor: 9 },
  { letra: 'G', valor: 8 },
  { letra: 'R', valor: 7 },
  { letra: 'S', valor: 6 },
  { letra: 'NI', valor: 5 },
]

export const KINDER_EN_ESCALA_HINT = 'E=10 · VG=9 · G=8 · R=7 · S=6 · NI=5'

/** Subjects K1: fk_materia 1–7 */
const SUBJECTS_K1: Omit<KinderEnIndicador, 'grado' | 'orden'>[] = [
  { id: 1, nombre: 'VOCABULARY' },
  { id: 2, nombre: 'PHONICS' },
  { id: 3, nombre: 'PRE MATH' },
  { id: 4, nombre: 'PRE-WRITING' },
  { id: 5, nombre: 'SHOW AND TELL PROJECT' },
  { id: 6, nombre: 'MUSIC' },
  { id: 7, nombre: 'MINDFULNESS' },
]

/** Subjects K2: fk_materia 8–14 */
const SUBJECTS_K2: Omit<KinderEnIndicador, 'grado' | 'orden'>[] = [
  { id: 8, nombre: 'VOCABULARY' },
  { id: 9, nombre: 'PHONICS' },
  { id: 10, nombre: 'PRE MATH' },
  { id: 11, nombre: 'PRE-WRITING' },
  { id: 12, nombre: 'SHOW AND TELL PROJECT' },
  { id: 13, nombre: 'MUSIC' },
  { id: 14, nombre: 'MINDFULNESS' },
]

/** Subjects K3: fk_materia 15–21 */
const SUBJECTS_K3: Omit<KinderEnIndicador, 'grado' | 'orden'>[] = [
  { id: 15, nombre: 'VOCABULARY' },
  { id: 16, nombre: 'PHONICS' },
  { id: 17, nombre: 'MATH' },
  { id: 18, nombre: 'WRITING' },
  { id: 19, nombre: 'SHOW AND TELL PROJECT' },
  { id: 20, nombre: 'MUSIC' },
  { id: 21, nombre: 'MINDFULNESS' },
]

/** Music / Mindfulness: fuera del promedio (legacy boleta_funciones). */
export const KINDER_EN_SUBJECT_IDS_EXCLUIDOS_PROMEDIO = new Set([6, 7, 13, 14, 20, 21])

/**
 * Behavioral: IDs estables propios del catálogo app (100+),
 * distintos del rango de subjects 1–21. Legacy pck usaba 1–13 por grado.
 */
const BEH_K12: Omit<KinderEnIndicador, 'grado' | 'orden'>[] = [
  { id: 101, nombre: 'MAKES REAL WORLD CONNECTIONS' },
  { id: 102, nombre: 'DEVELOPS COORDINATION AND BALANCE' },
  { id: 103, nombre: 'COMMUNICATES CLEARLY' },
  { id: 104, nombre: 'UNDERSTANDING OF RULES DIRECTIONS AND ROUTINES' },
  { id: 105, nombre: 'SHOWS RESPECT TO TEACHERS AND CLASSMATES' },
  { id: 106, nombre: 'INVESTS TIME IN ACTIVITIES DESPITE DISTRACTIONS' },
  { id: 107, nombre: 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING' },
  { id: 108, nombre: 'WORK IS NEAT AND ORGANIZED' },
  { id: 109, nombre: 'USES MATERIALS SAFELY AND APPROPRIATELY' },
  { id: 110, nombre: 'TAKES TURNS DURING ACTIVITIES' },
  { id: 111, nombre: 'COMPLETES DAILY WORK' },
  { id: 112, nombre: 'DOES HOMEWORK' },
  { id: 113, nombre: 'PUNCTUALITY' },
]

const BEH_K3: Omit<KinderEnIndicador, 'grado' | 'orden'>[] = [
  { id: 101, nombre: 'SELF CONTROL' },
  { id: 102, nombre: 'UNDERSTANDING OF RULES DIRECTIONS AND ROUTINES' },
  { id: 103, nombre: 'SHOWS RESPECT TO TEACHERS AND CLASSMATES' },
  { id: 104, nombre: 'INVESTS TIME IN ACTIVITIES DESPITE DISTRACTIONS' },
  { id: 105, nombre: 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING' },
  { id: 106, nombre: 'WORK IS NEAT AND ORGANIZED' },
  { id: 107, nombre: 'USES MATERIALS SAFELY AND APPROPRIATELY' },
  { id: 108, nombre: 'TAKES TURNS DURING ACTIVITIES' },
  { id: 109, nombre: 'COMPLETES DAILY WORK' },
  { id: 110, nombre: 'DOES HOMEWORK' },
  { id: 111, nombre: 'PUNCTUALITY' },
]

/** Maternal: hasta 17 ítems (legacy pcm fk_materia 1–17; 16=SCHOOL DAYS, 17=DAYS ABSENT). */
const MATERNAL: Omit<KinderEnIndicador, 'grado' | 'orden'>[] = [
  { id: 1, nombre: 'IDENTIFIES AND NAMES NUMBERS FROM 1 TO 10' },
  { id: 2, nombre: 'IDENTIFIES AND NAMES COLORS' },
  { id: 3, nombre: 'IDENTIFIES AND NAMES BASIC SHAPES' },
  { id: 4, nombre: 'KNOWS THE DAYS OF THE WEEK' },
  { id: 5, nombre: 'IDENTIFIES VOWELS AND THEIR VOCABULARY' },
  { id: 6, nombre: 'UNDERSTANDING OF RULES AND ROUTINES' },
  { id: 7, nombre: 'DOES CLASSWORK INDEPENDENTLY' },
  { id: 8, nombre: 'DEVELOPS COORDINATION AND BALANCE' },
  { id: 9, nombre: 'USES MATERIALS SAFELY AND APPROPRIATELY' },
  { id: 10, nombre: 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING' },
  { id: 11, nombre: 'TAKES TURNS DURING ACTIVITIES' },
  { id: 12, nombre: 'COMMUNICATES CLEARLY' },
  { id: 13, nombre: 'SHOWS RESPECT TO TEACHERS AND CLASSMATES' },
  { id: 14, nombre: 'DOES HOMEWORK' },
  { id: 15, nombre: 'PUNCTUALITY' },
  { id: 16, nombre: 'SCHOOL DAYS' },
  { id: 17, nombre: 'DAYS ABSENT' },
]

function conMeta(
  grado: KinderEnGrado,
  rows: Omit<KinderEnIndicador, 'grado' | 'orden'>[]
): KinderEnIndicador[] {
  return rows.map((r, i) => ({ ...r, grado, orden: i + 1 }))
}

export const KINDER_EN_SUBJECTS: KinderEnIndicador[] = [
  ...conMeta(1, SUBJECTS_K1),
  ...conMeta(2, SUBJECTS_K2),
  ...conMeta(3, SUBJECTS_K3),
]

export const KINDER_EN_BEHAVIORAL: KinderEnIndicador[] = [
  ...conMeta(1, BEH_K12),
  ...conMeta(2, BEH_K12),
  ...conMeta(3, BEH_K3),
]

export const KINDER_EN_MATERNAL: KinderEnIndicador[] = conMeta(0, MATERNAL)

export function subjectsPorGrado(grado: KinderEnGrado): KinderEnIndicador[] {
  if (grado === 0) return []
  return KINDER_EN_SUBJECTS.filter((i) => i.grado === grado)
}

export function behavioralPorGrado(grado: KinderEnGrado): KinderEnIndicador[] {
  if (grado === 0) return []
  return KINDER_EN_BEHAVIORAL.filter((i) => i.grado === grado)
}

export function maternalIndicadores(): KinderEnIndicador[] {
  return KINDER_EN_MATERNAL
}

export function esMaternal(grado: KinderEnGrado): boolean {
  return grado === 0
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
