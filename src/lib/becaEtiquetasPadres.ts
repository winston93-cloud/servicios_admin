/**
 * 2026-09-03 - Etiquetas de beca para papás (carta / portal).
 * Admin distingue Hermanos (2)/(3); papás ven solo «Hermanos».
 */

export function etiquetaBecaParaPadres(
  becaClase: string | null | undefined
): string {
  const raw = (becaClase || '').trim()
  if (!raw) return raw
  const upper = raw.toUpperCase()
  if (
    upper === 'HERMANOS' ||
    /^HERMANOS\s*\([23]\)$/.test(upper) ||
    /^POR\s+[23]\s+HERMANOS$/.test(upper)
  ) {
    return 'Hermanos'
  }
  return raw
}
