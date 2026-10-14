/** Primaria (nivel 3): constantes, escalas y validación compartidas por servidor y pantallas de captura. */

export type IdiomaPrimaria = 'es' | 'en'
export type PrimariaGrado = 1 | 2 | 3 | 4 | 5 | 6

export const BOLETAS_NIVEL_PRIMARIA = 3

export const PRIMARIA_GRADOS: { valor: PrimariaGrado; etiqueta: string }[] = ([1, 2, 3, 4, 5, 6] as const).map(
  (valor) => ({ valor, etiqueta: `${valor}°` })
)

export const PRIMARIA_GRUPOS = ['A', 'B', 'C'] as const

export const PRIMARIA_NO_APLICA = 'N/A'
export const PRIMARIA_CALIF_MIN = 5
export const PRIMARIA_DIAS_MAX = 120

/** Decimales de captura y promedios: Español 1 (bcdiv 1), Inglés 2 (decimal(4,2) del legacy). */
export const PRIMARIA_DECIMALES: Record<IdiomaPrimaria, 1 | 2> = { es: 1, en: 2 }

export const PRIMARIA_CALIF_HINT: Record<IdiomaPrimaria, string> = {
  es: 'Calificación de 5 a 10 con un decimal (ej. 9.5). N/A si esa materia no se evaluó en el trimestre.',
  en: 'Calificación de 5 a 10 con hasta dos decimales (ej. 9.75). N/A si esa materia no se evaluó en el trimestre.',
}

export function mensajeCalificacionPrimaria(decimales: number): string {
  return decimales === 2
    ? 'escribe una calificación de 5 a 10 (hasta dos decimales, ej. 9.75) o N/A'
    : 'escribe una calificación de 5 a 10 (un decimal, ej. 9.5) o N/A'
}

export type PrimariaEscala = { letra: string; etiqueta: string }[]

export type PrimariaSeccion = {
  id: string
  titulo: string
  /** decimal = 5 a 10 (decimales según PRIMARIA_DECIMALES) o N/A; escala = botones con letras. */
  formato: 'decimal' | 'escala'
  /** Promedio de la sección por trimestre (en la boleta y en la captura). */
  promedio: boolean
}

export const PRIMARIA_ESCALA: Record<IdiomaPrimaria, PrimariaEscala> = {
  es: [
    { letra: 'E', etiqueta: 'Excelente' },
    { letra: 'MB', etiqueta: 'Muy bien' },
    { letra: 'B', etiqueta: 'Bien' },
    { letra: 'R', etiqueta: 'Regular' },
    { letra: 'S', etiqueta: 'Satisfactorio' },
    { letra: 'NS', etiqueta: 'No satisfactorio' },
  ],
  en: [
    { letra: 'E', etiqueta: 'Excellent' },
    { letra: 'VG', etiqueta: 'Very good' },
    { letra: 'G', etiqueta: 'Good' },
    { letra: 'R', etiqueta: 'Regular' },
    { letra: 'S', etiqueta: 'Satisfactory' },
    { letra: 'U', etiqueta: 'Unsatisfactory' },
  ],
}

export const PRIMARIA_SECCIONES: Record<IdiomaPrimaria, PrimariaSeccion[]> = {
  es: [
    { id: 'lenguajes', titulo: 'Lenguajes', formato: 'decimal', promedio: true },
    { id: 'saberes', titulo: 'Saberes y pensamiento científico', formato: 'decimal', promedio: true },
    { id: 'humano', titulo: 'De lo humano y lo comunitario', formato: 'decimal', promedio: true },
    { id: 'etica', titulo: 'Ética, naturaleza y sociedades', formato: 'decimal', promedio: true },
    { id: 'extra', titulo: 'Clases extracurriculares', formato: 'decimal', promedio: true },
    { id: 'habilidades', titulo: 'Habilidades conductuales', formato: 'escala', promedio: false },
  ],
  en: [
    { id: 'subject', titulo: 'Subjects', formato: 'decimal', promedio: true },
    { id: 'extra', titulo: 'Mindfulness · Faith', formato: 'decimal', promedio: false },
    { id: 'skill', titulo: 'Behavioral skills', formato: 'escala', promedio: false },
  ],
}

export function esGradoPrimaria(n: number): n is PrimariaGrado {
  return Number.isInteger(n) && n >= 1 && n <= 6
}

export function etiquetaGrupoPrimaria(grado: number, grupo: string): string {
  return `${grado}° ${grupo}`
}

export function grupoNumeroDesdeLetra(letra: string): number {
  return ({ A: 1, B: 2, C: 3 } as Record<string, number>)[String(letra).toUpperCase()] ?? 0
}

export function letraDesdeGrupoNumero(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C' } as Record<number, string>)[n] ?? String(n)
}

/**
 * '' = sin capturar; 'N/A'; o número de 5 a 10 con hasta `decimales` decimales
 * (1: "9" → "9.0", "9,5" → "9.5"; 2: "9.5" → "9.50"). null = inválido.
 */
export function normalizarCalificacionPrimaria(raw: unknown, decimales = 1): string | null {
  const s = String(raw ?? '').trim().toUpperCase().replace(',', '.')
  if (!s) return ''
  if (s === 'N/A' || s === 'NA' || /^-+$/.test(s)) return PRIMARIA_NO_APLICA
  if (!new RegExp(`^\\d{1,2}(\\.\\d{1,${decimales}})?$`).test(s)) return null
  const n = Number(s)
  if (!(n >= PRIMARIA_CALIF_MIN && n <= 10)) return null
  return n.toFixed(decimales)
}

/** '' o letra de la escala del idioma (acepta minúsculas). null = inválida. */
export function normalizarEscalaPrimaria(idioma: IdiomaPrimaria, raw: unknown): string | null {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s) return ''
  return PRIMARIA_ESCALA[idioma].some((e) => e.letra === s) ? s : null
}

/** '' o entero de 0 a 120. null = inválido. */
export function normalizarDiasPrimaria(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (!/^\d{1,3}$/.test(s)) return null
  const n = Number(s)
  return n <= PRIMARIA_DIAS_MAX ? String(n) : null
}

/** Promedio truncado a `decimales` como el legacy (bcdiv); 10 se escribe sin decimales. */
export function promedioPrimaria(valores: string[], decimales = 1): string {
  const nums = valores.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
  if (!nums.length) return ''
  const f = 10 ** decimales
  return formatoCalificacion(Math.floor((nums.reduce((a, b) => a + b, 0) / nums.length) * f + 1e-9) / f, decimales)
}

export function formatoCalificacion(n: number | string, decimales = 1): string {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return String(n)
  return v === 10 ? '10' : v.toFixed(decimales)
}
