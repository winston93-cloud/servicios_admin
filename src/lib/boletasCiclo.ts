/** Ciclo escolar boletas: valor = añoInicio − 2003 (legacy PHP). Ej. 23 → 2026-2027. */

export const BOLETAS_CICLO_OFFSET = 2003

/** Nivel secundaria en catálogo boleta_materia / alumno. */
export const BOLETAS_NIVEL_SECUNDARIA = 4

/** Mindfulness — fuera del promedio Winston (ids legacy). */
export const MATERIA_IDS_MINDFULNESS = [45, 46, 47] as const

export function cicloDesdeAnio(anioInicio: number): number {
  return anioInicio - BOLETAS_CICLO_OFFSET
}

export function anioDesdeCiclo(ciclo: number): number {
  return ciclo + BOLETAS_CICLO_OFFSET
}

export function etiquetaCicloBoletas(ciclo: number): string {
  const a = anioDesdeCiclo(ciclo)
  return `${a}-${a + 1}`
}

/** Ciclo “actual” por calendario escolar (ago–jul): si mes >= 8 usa año actual. */
export function cicloEscolarActualBoletas(now = new Date()): number {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const anioInicio = m >= 8 ? y : y - 1
  return cicloDesdeAnio(anioInicio)
}

/** Opciones históricas + actual (desde ciclo 15 ≈ 2018-2019). */
export function opcionesCicloBoletas(hasta = cicloEscolarActualBoletas()): { valor: number; etiqueta: string }[] {
  const desde = 15
  const out: { valor: number; etiqueta: string }[] = []
  for (let c = hasta; c >= desde; c--) {
    out.push({ valor: c, etiqueta: etiquetaCicloBoletas(c) })
  }
  return out
}

/** Mapeo alumno_grupo numérico → letra. */
const GRUPOS = ['', 'A', 'B', 'C', 'D', 'E', 'F']

export function letraDesdeGrupoNum(grupo: number): string {
  return GRUPOS[grupo] ?? ''
}

export function grupoNumDesdeLetra(letra: string): number | null {
  const L = letra.trim().toUpperCase()
  if (!L) return null
  const idx = GRUPOS.indexOf(L)
  return idx > 0 ? idx : null
}

/** grupo_letra legacy: "A", "B", "ABC" (todos), etc. */
export function grupoCoincide(letraAsignacion: string | null | undefined, grupoAlumno: number): boolean {
  const raw = String(letraAsignacion ?? '').trim().toUpperCase()
  if (!raw) return true
  if (raw === 'ABC' || raw === 'ABCD' || raw === '*') return true
  const letra = letraDesdeGrupoNum(grupoAlumno)
  if (!letra) return false
  return raw.includes(letra)
}

export function etiquetaGradoSecundaria(grado: number): string {
  if (grado === 1) return '7mo'
  if (grado === 2) return '8vo'
  if (grado === 3) return '9no'
  return `${grado}°`
}
