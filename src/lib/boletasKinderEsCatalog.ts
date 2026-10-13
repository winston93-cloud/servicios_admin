/** Kinder Español (legacy boletasek): campos académicos K1–K3 calificados de 0 a 10 con un decimal. */

export type KinderEsGrado = 1 | 2 | 3

export type KinderEsIndicador = {
  /** Coincide con fk_materia legacy */
  id: number
  grado: KinderEsGrado
  nombre: string
  orden: number
  activo: boolean
}

/** Nivel alumno Winston: 2 = Kinder */
export const BOLETAS_NIVEL_KINDER = 2

export const KINDER_ES_GRADOS: { valor: KinderEsGrado; etiqueta: string }[] = [
  { valor: 1, etiqueta: 'K1' },
  { valor: 2, etiqueta: 'K2' },
  { valor: 3, etiqueta: 'K3' },
]

export const KINDER_ES_GRUPOS = ['A', 'B', 'C', 'D'] as const

/** No se evaluó ese trimestre (en el legacy se capturaba «----»). */
export const KINDER_ES_NO_APLICA = 'N/A'

export const KINDER_ES_ESCALA_HINT =
  'Calificación de 0 a 10 con un decimal (ej. 9.5). N/A si ese campo no se evaluó en el trimestre.'

export function esGradoKinderEs(n: number): n is KinderEsGrado {
  return n === 1 || n === 2 || n === 3
}

export function etiquetaGradoKinderEs(grado: number): string {
  return KINDER_ES_GRADOS.find((g) => g.valor === grado)?.etiqueta ?? `K${grado}`
}

export function etiquetaGrupoKinderEs(grado: number, grupo: string): string {
  return `${etiquetaGradoKinderEs(grado)} ${grupo}`
}

/**
 * '' = sin capturar; 'N/A'; o número 0–10 con un decimal ("9" → "9.0", "9,5" → "9.5").
 * null = valor inválido.
 */
export function normalizarCalificacionKinderEs(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toUpperCase().replace(',', '.')
  if (!s) return ''
  if (s === 'N/A' || s === 'NA' || /^-+$/.test(s)) return KINDER_ES_NO_APLICA
  if (!/^\d{1,2}(\.\d)?$/.test(s)) return null
  const n = Number(s)
  if (!(n >= 0 && n <= 10)) return null
  return n.toFixed(1)
}

export function grupoNumeroDesdeLetra(letra: string): number {
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
  return map[letra.toUpperCase()] ?? 0
}

export function letraDesdeGrupoNumero(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' } as Record<number, string>)[n] ?? String(n)
}
