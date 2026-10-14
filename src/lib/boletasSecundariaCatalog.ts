/** Secundaria (nivel 4): escalas, validación y promedios compartidos por servidor y pantallas. */

export const BOLETAS_NIVEL_SEC = 4

export type SecundariaGrado = 1 | 2 | 3
export type SecundariaSeccion = 'set' | 'winston'

export const SECUNDARIA_GRADOS: { valor: SecundariaGrado; etiqueta: string }[] = [
  { valor: 1, etiqueta: '7°' },
  { valor: 2, etiqueta: '8°' },
  { valor: 3, etiqueta: '9°' },
]

export const SECUNDARIA_GRUPOS = ['A', 'B', 'C'] as const

export const SECCION_ETIQUETA: Record<SecundariaSeccion, string> = {
  set: 'SET (oficiales SEP)',
  winston: 'Winston',
}

export function esGradoSecundaria(n: unknown): n is SecundariaGrado {
  return n === 1 || n === 2 || n === 3
}

export function esGrupoSecundaria(g: unknown): g is string {
  return typeof g === 'string' && (SECUNDARIA_GRUPOS as readonly string[]).includes(g)
}

/** 1 → «7°». */
export function etiquetaGradoSec(grado: number): string {
  return SECUNDARIA_GRADOS.find((g) => g.valor === grado)?.etiqueta ?? `${grado}°`
}

export function etiquetaGrupoSec(grado: number, grupo: string): string {
  return `${etiquetaGradoSec(grado)} ${grupo}`
}

export function grupoNumeroSec(letra: string): number {
  return ({ A: 1, B: 2, C: 3 } as Record<string, number>)[String(letra).toUpperCase()] ?? 0
}

export function letraGrupoSec(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C' } as Record<number, string>)[n] ?? ''
}

// ── Calificación: entero 5–10 o «-» (legacy: «-» se guarda como 0 y cuenta como 0 en promedios) ──

export const SIN_CALIFICACION = '-'

/** '' = sin capturar; '-' ; o '5'…'10'. null = inválida. Acepta «0», «10.0», «9,0». */
export function normalizarCalifSec(raw: unknown): string | null {
  const s = String(raw ?? '').trim().replace(',', '.')
  if (!s) return ''
  if (/^-+$/.test(s)) return SIN_CALIFICACION
  if (!/^\d{1,2}(\.0+)?$/.test(s)) return null
  const n = Number(s)
  if (n === 0) return SIN_CALIFICACION
  return n >= 5 && n <= 10 ? String(n) : null
}

/** Valor guardado en `calificacion_puntos` → lo que ve la hoja ('', '-', '5'…'10'). */
export function califDesdeBd(v: unknown): string {
  if (v == null) return ''
  const n = Number(String(v).trim().replace(',', '.'))
  if (!Number.isFinite(n)) return ''
  if (n === 0) return SIN_CALIFICACION
  return String(Math.trunc(n))
}

export function califABd(v: string): string {
  return v === SIN_CALIFICACION ? '0' : v
}

// ── Conducta: legacy guarda 1–6 ──

export const CONDUCTA_ESCALA = [
  { codigo: '1', letra: 'E', etiqueta: 'Excelente' },
  { codigo: '2', letra: 'MB', etiqueta: 'Muy bien' },
  { codigo: '3', letra: 'B', etiqueta: 'Bien' },
  { codigo: '4', letra: 'R', etiqueta: 'Regular' },
  { codigo: '5', letra: 'S', etiqueta: 'Suficiente' },
  { codigo: '6', letra: 'I', etiqueta: 'Insuficiente' },
] as const

/** '' o código '1'…'6'. Acepta la letra (E, MB, B, R, S, I) o el número. null = inválida. */
export function normalizarConducta(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s) return ''
  const e = CONDUCTA_ESCALA.find((c) => c.codigo === s || c.letra === s)
  return e ? e.codigo : null
}

export function letraConducta(codigo: unknown): string {
  return CONDUCTA_ESCALA.find((c) => c.codigo === String(codigo ?? '').trim())?.letra ?? ''
}

// ── Faltas ──

export const FALTAS_MAX = 99

/** '' o entero 0–99. null = inválido. */
export function normalizarFaltas(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (!/^\d{1,2}$/.test(s)) return null
  return String(Number(s))
}

// ── Comprensión lectora (solo materias marcadas, p. ej. Español) ──

export const COMPRENSION_MESES = [
  { mes: 1, etiqueta: 'Agosto' },
  { mes: 2, etiqueta: 'Noviembre' },
  { mes: 3, etiqueta: 'Marzo' },
  { mes: 4, etiqueta: 'Junio' },
] as const

export const COMPRENSION_PREGUNTAS = [
  { id: 'p1', corto: 'Opinión', texto: 'Analiza el contenido de un texto para dar su opinión' },
  { id: 'p2', corto: 'Síntesis', texto: 'Sintetiza la información proporcionada por dos o más textos' },
  { id: 'p3', corto: 'Argumentos', texto: 'Utiliza la información contenida en uno o más textos para desarrollar argumentos' },
] as const

export type ComprensionPregunta = (typeof COMPRENSION_PREGUNTAS)[number]['id']

export const COMPRENSION_ESCALA = [
  { codigo: '1', letra: 'S', etiqueta: 'Siempre' },
  { codigo: '2', letra: 'CS', etiqueta: 'Casi siempre' },
  { codigo: '3', letra: 'EO', etiqueta: 'En ocasiones' },
  { codigo: '4', letra: 'RA', etiqueta: 'Requiere apoyo condicional' },
] as const

/** '' o código '1'…'4'. Acepta la sigla (S, CS, EO, RA) o el número. null = inválida. */
export function normalizarComprension(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s) return ''
  const e = COMPRENSION_ESCALA.find((c) => c.codigo === s || c.letra === s)
  return e ? e.codigo : null
}

export function letraComprension(codigo: unknown): string {
  return COMPRENSION_ESCALA.find((c) => c.codigo === String(codigo ?? '').trim())?.letra ?? ''
}

export function esMesComprension(n: unknown): n is 1 | 2 | 3 | 4 {
  return n === 1 || n === 2 || n === 3 || n === 4
}

// ── Promedios (legacy BoletaPdfGenerator: trunca, nunca redondea) ──

/** Trunca a `dec` decimales (bcdiv). */
export function truncar(n: number, dec: number): number {
  const f = 10 ** dec
  return Math.floor(n * f + 1e-9) / f
}

export function fmtTrunc(n: number | null, dec: number): string {
  return n == null ? '' : truncar(n, dec).toFixed(dec)
}

/** Promedio de una materia: media de sus calificaciones capturadas (incluye «-» = 0). null si no hay ninguna. */
export function promedioMateria(califs: string[]): number | null {
  const vals = califs.filter((c) => c !== '').map((c) => (c === SIN_CALIFICACION ? 0 : Number(c)))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

/** Promedio de la materia como sale en la boleta: entero truncado. */
export function promedioMateriaBoleta(califs: string[]): string {
  const p = promedioMateria(califs)
  return p == null ? '' : String(Math.trunc(p + 1e-9))
}
