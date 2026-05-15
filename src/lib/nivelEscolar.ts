/** Valores de `alumno_nivel` en MySQL / Supabase. */
export const NIVELES_ESCOLARES_OPCIONES = [
  { valor: 1, etiqueta: 'Maternal' },
  { valor: 2, etiqueta: 'Kinder' },
  { valor: 3, etiqueta: 'Primaria' },
  { valor: 4, etiqueta: 'Secundaria' },
] as const

export type NivelEscolarValor = (typeof NIVELES_ESCOLARES_OPCIONES)[number]['valor']

export function parseNivelEscolar(
  nivel: string | number | null | undefined
): number | null {
  if (nivel == null || nivel === '') return null
  const n = typeof nivel === 'number' ? nivel : parseInt(String(nivel), 10)
  return Number.isNaN(n) ? null : n
}

export function etiquetaNivelEscolar(
  nivel: string | number | null | undefined
): string {
  const n = parseNivelEscolar(nivel)
  if (n == null) return ''
  const hit = NIVELES_ESCOLARES_OPCIONES.find((o) => o.valor === n)
  return hit?.etiqueta ?? `Nivel ${n}`
}

export function nivelEscolarPorDefecto(
  nivel: string | number | null | undefined
): NivelEscolarValor {
  const n = parseNivelEscolar(nivel)
  if (n != null && NIVELES_ESCOLARES_OPCIONES.some((o) => o.valor === n)) {
    return n as NivelEscolarValor
  }
  return NIVELES_ESCOLARES_OPCIONES[0].valor
}
