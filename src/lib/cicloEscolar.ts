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
  ciclo: string | number | null | undefined
): string {
  const n = parseCicloEscolar(ciclo)
  if (n == null) return ''
  const hit = CICLOS_ESCOLARES_OPCIONES.find((c) => c.valor === n)
  return hit?.etiqueta ?? String(ciclo)
}

export function cicloEscolarPorDefecto(
  ciclo: string | number | null | undefined
): CicloEscolarValor {
  const n = parseCicloEscolar(ciclo)
  if (n != null && CICLOS_ESCOLARES_OPCIONES.some((c) => c.valor === n)) {
    return n as CicloEscolarValor
  }
  return CICLOS_ESCOLARES_OPCIONES[0].valor
}
