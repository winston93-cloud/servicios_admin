/** Catálogo Primaria Inglés — subjects/skills/attendance (legacy ingles: ing_mat / ing_skill / ing_att). */

export type PrimariaEnGrado = 1 | 2 | 3 | 4 | 5 | 6

export type PrimariaEnMateria = {
  /** materia_id estable en app (alineado a mat_id legacy cuando aplica). */
  id: number
  nombre: string
  orden: number
  grados: PrimariaEnGrado[]
  /** Si false, no entra al promedio de subjects. */
  enPromedio: boolean
  /** Umbrales de color opcionales (legacy mindfulness fila 9 / colorMindfulnessPrimaria). */
  mindfulnessColor?: boolean
}

export type PrimariaEnSkill = {
  id: number
  nombre: string
  orden: number
}

/** Nivel alumno Winston: 3 = Primaria */
export const BOLETAS_NIVEL_PRIMARIA = 3

export const PRIMARIA_EN_GRADOS: { valor: PrimariaEnGrado; etiqueta: string }[] = [
  { valor: 1, etiqueta: '1°' },
  { valor: 2, etiqueta: '2°' },
  { valor: 3, etiqueta: '3°' },
  { valor: 4, etiqueta: '4°' },
  { valor: 5, etiqueta: '5°' },
  { valor: 6, etiqueta: '6°' },
]

/** Grupos A–C (legacy captura primaria inglés). */
export const PRIMARIA_EN_GRUPOS = ['A', 'B', 'C'] as const

/**
 * Escala skills (letras). Subjects usan numérico (texto libre permitido).
 * E / VG / G / R / S / U (legacy CSV habilidades_conductuales).
 */
export const PRIMARIA_EN_ESCALA_SKILL: { letra: string; etiqueta: string }[] = [
  { letra: 'E', etiqueta: 'Excellent' },
  { letra: 'VG', etiqueta: 'Very Good' },
  { letra: 'G', etiqueta: 'Good' },
  { letra: 'R', etiqueta: 'Regular' },
  { letra: 'S', etiqueta: 'Satisfactory' },
  { letra: 'U', etiqueta: 'Unsatisfactory' },
]

export const PRIMARIA_EN_ESCALA_HINT =
  'Subjects: numérico · Skills: E / VG / G / R / S / U (texto libre permitido)'

const G_LE_3: PrimariaEnGrado[] = [1, 2, 3]
const G_GE_4: PrimariaEnGrado[] = [4, 5, 6]
const G_ALL: PrimariaEnGrado[] = [1, 2, 3, 4, 5, 6]

/**
 * Subjects por grado (nombres CSV materias.csv + computacion_educ_fe.csv).
 * IDs: g1–3 usan mat_id legacy 1,4–11; g4–6 usan 2–11 (addreg.php / grading_card).
 * MINDFULNESS (id 12): slot reciente con color opcional; fuera de promedio.
 */
export const PRIMARIA_EN_MATERIAS: PrimariaEnMateria[] = [
  // Grades 1–3 (7 core + computer + faith + mindfulness)
  { id: 1, nombre: 'GRAMMAR', orden: 1, grados: G_LE_3, enPromedio: true },
  { id: 4, nombre: 'READING', orden: 2, grados: G_LE_3, enPromedio: true },
  { id: 5, nombre: 'SPELLING', orden: 3, grados: G_LE_3, enPromedio: true },
  { id: 6, nombre: 'VOCABULARY', orden: 4, grados: G_LE_3, enPromedio: true },
  { id: 7, nombre: 'MATHEMATICS', orden: 5, grados: G_LE_3, enPromedio: true },
  { id: 8, nombre: 'ENGLISH', orden: 6, grados: G_LE_3, enPromedio: true },
  { id: 9, nombre: 'LISTENING', orden: 7, grados: G_LE_3, enPromedio: true },
  // Grades 4–6 (8 core + computer + faith + mindfulness)
  { id: 2, nombre: 'VOCABULARY', orden: 1, grados: G_GE_4, enPromedio: true },
  { id: 3, nombre: 'SPELLING', orden: 2, grados: G_GE_4, enPromedio: true },
  { id: 4, nombre: 'GRAMMAR', orden: 3, grados: G_GE_4, enPromedio: true },
  { id: 5, nombre: 'READING COMPREHENSION', orden: 4, grados: G_GE_4, enPromedio: true },
  { id: 6, nombre: 'MEMORY WORK', orden: 5, grados: G_GE_4, enPromedio: true },
  { id: 7, nombre: 'MATH', orden: 6, grados: G_GE_4, enPromedio: true },
  { id: 8, nombre: 'ENGLISH', orden: 7, grados: G_GE_4, enPromedio: true },
  { id: 9, nombre: 'LISTENINGS', orden: 8, grados: G_GE_4, enPromedio: true },
  // Shared extras (legacy computer/faith mat_id 10–11; mindfulness app id 12)
  {
    id: 12,
    nombre: 'MINDFULNESS',
    orden: 90,
    grados: G_ALL,
    enPromedio: false,
    mindfulnessColor: true,
  },
  {
    id: 10,
    nombre: 'COMPUTER SCIENCE (COMPUTACION)',
    orden: 91,
    grados: G_ALL,
    enPromedio: false,
  },
  { id: 11, nombre: 'FAITH', orden: 92, grados: G_ALL, enPromedio: false },
]

/** Behavioral skills — skill_id 1–7 (CSV habilidades_conductuales). */
export const PRIMARIA_EN_SKILLS: PrimariaEnSkill[] = [
  { id: 1, nombre: 'SELF CONTROL', orden: 1 },
  { id: 2, nombre: 'LISTENS CAREFULLY', orden: 2 },
  { id: 3, nombre: 'FOLLOWS DIRECTIONS', orden: 3 },
  { id: 4, nombre: 'WORKS NEATLY', orden: 4 },
  { id: 5, nombre: 'COMPLETES DAILY WORK', orden: 5 },
  { id: 6, nombre: 'SHOWS A POSITIVE ATTITUDE', orden: 6 },
  { id: 7, nombre: 'HOMEWORK', orden: 7 },
]

export function materiasPorGrado(grado: PrimariaEnGrado): PrimariaEnMateria[] {
  return PRIMARIA_EN_MATERIAS.filter((m) => m.grados.includes(grado)).sort(
    (a, b) => a.orden - b.orden || a.id - b.id
  )
}

export function skillsCatalogo(): PrimariaEnSkill[] {
  return PRIMARIA_EN_SKILLS
}

export function grupoNumeroDesdeLetra(letra: string): number {
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
  return map[letra.toUpperCase()] ?? 0
}

export function letraDesdeGrupoNumero(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' } as Record<number, string>)[n] ?? String(n)
}

/** RGB mindfulness (legacy colorMindfulnessPrimariaPorCalificacion). */
export function colorMindfulnessPrimaria(calificacion: string): [number, number, number] | null {
  const valor = calificacion.trim().toUpperCase()
  if (!valor) return null
  if (/^-?\d+(\.\d+)?$/.test(valor)) {
    const n = Number(valor)
    if (n >= 8) return [0, 176, 80]
    if (n >= 6) return [255, 192, 0]
    return [255, 0, 0]
  }
  if (valor === 'E' || valor === 'VG') return [0, 176, 80]
  if (valor === 'G' || valor === 'R') return [255, 192, 0]
  if (valor === 'S' || valor === 'U' || valor === 'NI') return [255, 0, 0]
  return null
}

/** Teachers inglés por grado/grupo (legacy nombreTeacherPrimaria). */
export function teacherInglesPrimaria(grado: number, grupoNum: number): string {
  const map: Record<string, string> = {
    '1_1': 'JOSELINE SIRLEM PIMIENTA SOSA',
    '1_2': 'JOSELINE SIRLEM PIMIENTA SOSA',
    '1_3': 'JOSELINE SIRLEM PIMIENTA SOSA',
    '2_1': 'MARIA EUGENIA DEL ANGEL MARTINEZ',
    '2_2': 'MARIA EUGENIA DEL ANGEL MARTINEZ',
    '2_3': 'MONICA XIMENA ACOSTA SALDIVAR',
    '3_1': 'ANA MELISA ESPINOSA MAYA',
    '3_2': 'ANA MELISA ESPINOSA MAYA',
    '3_3': 'CITLALLI CANTERO PUGA',
    '4_1': 'PRISCILLA BARRAGAN DI BELLA',
    '4_2': 'PRISCILLA BARRAGAN DI BELLA',
    '4_3': 'MARIA DEL CARMEN UGALDE LOPEZ',
    '5_1': 'BEATRIZ ADRIANA SOTELO SANCHEZ',
    '5_2': 'BEATRIZ ADRIANA SOTELO SANCHEZ',
    '5_3': 'ANGELA NAYELI MARTINEZ ALVAREZ',
    '6_1': 'JUANITA MERCEDES HERNANDEZ GARCIA',
    '6_2': 'JUANITA MERCEDES HERNANDEZ GARCIA',
    '6_3': 'ANGELA NAYELI MARTINEZ ALVAREZ',
  }
  return map[`${grado}_${grupoNum}`] ?? ''
}

export function promedioSubjectsNumerico(
  rows: { id: number; calificacion: string }[],
  materias: PrimariaEnMateria[]
): string {
  const porId = new Map(materias.map((m) => [m.id, m]))
  let suma = 0
  let cant = 0
  for (const r of rows) {
    const meta = porId.get(r.id)
    if (!meta?.enPromedio) continue
    const raw = r.calificacion.trim()
    if (!raw) continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) continue
    suma += n
    cant++
  }
  if (!cant) return ''
  return (suma / cant).toFixed(1)
}
