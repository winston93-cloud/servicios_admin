/** Valores de `alumno_ciclo_escolar` en MySQL / Supabase. */
export const CICLOS_ESCOLARES_OPCIONES = [
  { valor: 22, etiqueta: '2025-2026' },
  { valor: 23, etiqueta: '2026-2027' },
] as const

export type CicloEscolarValor = (typeof CICLOS_ESCOLARES_OPCIONES)[number]['valor']

export function parseCicloEscolar(
  ciclo: string | number | null | undefined
): number | null {
  if (ciclo == null || ciclo === '') return null
  const n = typeof ciclo === 'number' ? ciclo : parseInt(String(ciclo), 10)
  return Number.isNaN(n) ? null : n
}

export function etiquetaCicloEscolar(
  ciclo: string | number | null | undefined,
  opciones: readonly { valor: number; etiqueta: string }[] = CICLOS_ESCOLARES_OPCIONES
): string {
  const n = parseCicloEscolar(ciclo)
  if (n == null) return ''
  const hit = opciones.find((c) => c.valor === n)
  return hit?.etiqueta ?? String(ciclo)
}

export function cicloEscolarPorDefecto(
  ciclo: string | number | null | undefined,
  opciones: readonly { valor: number; etiqueta: string }[] = CICLOS_ESCOLARES_OPCIONES,
  fallback: number = CICLOS_ESCOLARES_OPCIONES[0].valor
): number {
  const n = parseCicloEscolar(ciclo)
  if (n != null && opciones.some((c) => c.valor === n)) {
    return n
  }
  if (opciones.some((c) => c.valor === fallback)) return fallback
  return opciones[0]?.valor ?? fallback
}
