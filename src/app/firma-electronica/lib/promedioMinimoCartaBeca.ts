/**
 * Promedio mínimo en carta de aceptación de beca (3 niveles).
 * Socioeconómica 9.0 · Académica 9.5 (editable en admin) · demás 8.0
 */
export const BECA_ID_ACADEMICA = 8
export const BECA_ID_SOCIOECONOMICA = 9

export const PROMEDIO_CARTA_ACADEMICA_DEFAULT = 9.5
export const PROMEDIO_CARTA_SOCIOECONOMICA = 9.0
export const PROMEDIO_CARTA_GENERAL = 8.0

const ENTEROS: Record<number, string> = {
  8: 'OCHO',
  9: 'NUEVE',
  10: 'DIEZ',
}

const DECIMAS: Record<number, string> = {
  0: 'CERO',
  5: 'CINCO',
}

function normalizarClase(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function esBecaAcademica(
  becaId?: number | null,
  becaClase?: string | null
): boolean {
  if (Number(becaId) === BECA_ID_ACADEMICA) return true
  const c = normalizarClase(becaClase)
  return c.includes('academ') && !c.includes('socio')
}

export function esBecaSocioeconomica(
  becaId?: number | null,
  becaClase?: string | null
): boolean {
  if (Number(becaId) === BECA_ID_SOCIOECONOMICA) return true
  return normalizarClase(becaClase).includes('socioeconom')
}

export function normalizarPromedioCarta(raw: unknown): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null
  return Math.round(n * 10) / 10
}

export function resolverPromedioMinimoCarta(opts: {
  becaId?: number | null
  becaClase?: string | null
  promedioAcademicoOverride?: number | null
}): number {
  if (esBecaSocioeconomica(opts.becaId, opts.becaClase)) {
    return PROMEDIO_CARTA_SOCIOECONOMICA
  }
  if (esBecaAcademica(opts.becaId, opts.becaClase)) {
    const ov = normalizarPromedioCarta(opts.promedioAcademicoOverride)
    return ov ?? PROMEDIO_CARTA_ACADEMICA_DEFAULT
  }
  return PROMEDIO_CARTA_GENERAL
}

export function formatearPromedioCarta(valor: number): string {
  return valor.toFixed(1)
}

export function promedioMinimoCartaALetras(valor: number): string {
  const n = normalizarPromedioCarta(valor) ?? PROMEDIO_CARTA_GENERAL
  const entero = Math.floor(n)
  const decima = Math.round((n - entero) * 10)
  const entTxt = ENTEROS[entero] ?? String(entero)
  const decTxt = DECIMAS[decima] ?? String(decima)
  return `${entTxt} PUNTO ${decTxt}`
}

export type PromedioMinimoCartaResuelto = {
  promedioMinimo: string
  promedioMinimoLetras: string
}

export function resolverPromedioMinimoCartaPdf(opts: {
  becaId?: number | null
  becaClase?: string | null
  promedioAcademicoOverride?: number | null
}): PromedioMinimoCartaResuelto {
  const valor = resolverPromedioMinimoCarta(opts)
  return {
    promedioMinimo: formatearPromedioCarta(valor),
    promedioMinimoLetras: promedioMinimoCartaALetras(valor),
  }
}
