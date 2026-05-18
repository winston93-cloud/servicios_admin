/** Sin asignar en BD (`alumno_grupo = 0`). */
export const GRUPO_SIN_ASIGNAR = 0

/** Valores de `alumno_grupo` en BD: 1 = A, 2 = B, 3 = C. */
export const GRUPOS_ESCOLARES_OPCIONES = [
  { valor: 1, etiqueta: 'A' },
  { valor: 2, etiqueta: 'B' },
  { valor: 3, etiqueta: 'C' },
] as const

/** Filtros y asignación masiva (incluye sin grupo). */
export const GRUPOS_ASIGNACION_OPCIONES = [
  { valor: GRUPO_SIN_ASIGNAR, etiqueta: 'Sin grupo' },
  ...GRUPOS_ESCOLARES_OPCIONES,
] as const

export type GrupoEscolarValor = (typeof GRUPOS_ESCOLARES_OPCIONES)[number]['valor']

export function parseGrupoEscolar(
  grupo: string | number | null | undefined
): number | null {
  if (grupo == null || grupo === '') return null
  const n = typeof grupo === 'number' ? grupo : parseInt(String(grupo), 10)
  return Number.isNaN(n) ? null : n
}

export function etiquetaGrupoEscolar(
  grupo: string | number | null | undefined
): string {
  const n = parseGrupoEscolar(grupo)
  if (n == null) return ''
  if (n === GRUPO_SIN_ASIGNAR) return 'Sin grupo'
  const hit = GRUPOS_ESCOLARES_OPCIONES.find((o) => o.valor === n)
  return hit?.etiqueta ?? String(grupo)
}

export function grupoEscolarPorDefecto(
  grupo: string | number | null | undefined
): GrupoEscolarValor {
  const n = parseGrupoEscolar(grupo)
  if (n != null && GRUPOS_ESCOLARES_OPCIONES.some((o) => o.valor === n)) {
    return n as GrupoEscolarValor
  }
  return GRUPOS_ESCOLARES_OPCIONES[0].valor
}
