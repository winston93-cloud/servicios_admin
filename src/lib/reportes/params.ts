import type { NivelId } from '@/lib/reportesCatalogData'

export const NIVEL_ID_A_VALOR: Record<NivelId, number> = {
  maternal: 1,
  kinder: 2,
  primaria: 3,
  secundaria: 4,
}

export function nivelIdToValor(nivel: string | null): number | null {
  if (!nivel) return null
  const v = NIVEL_ID_A_VALOR[nivel as NivelId]
  return v ?? null
}

export function parseCicloParam(value: string | null): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}
