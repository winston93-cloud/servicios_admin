/**
 * Ciclos escolares Winston (numérico: 22→23→24… = 2025-2026 → 2026-2027 → …).
 * El ciclo “de temporada” lo marca `ciclos_escolares.es_actual` en BD;
 * la fecha solo es fallback si aún no hay catálogo.
 */

export type CicloEscolar = {
  numero: number
  etiqueta: string
  anioInicio: number
  anioFin: number
}

/** Fecha de referencia (útil en tests); por defecto hoy en México. */
function fechaReferencia(ref?: Date): Date {
  return ref ?? new Date()
}

/**
 * Fallback por calendario (corte agosto). Preferir `es_actual` vía
 * `obtenerCicloEscolarActual` / CicloEscolarContext.
 */
export function getCicloEscolarActual(ref?: Date): number {
  const d = fechaReferencia(ref)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return m < 8 ? y - 2004 : y - 2003
}

/**
 * Fallback si no hay catálogo en BD. Preferir `proyectarCicloInscripcion`
 * desde el ciclo de temporada (`es_actual`).
 */
export function getCicloInscripcion(ref?: Date): number {
  return proyectarCicloInscripcion(getCicloEscolarActual(ref))
}

/** Destino de inscripción/reinscripción: origen + 1 (22→23, 23→24, …). */
export function proyectarCicloInscripcion(cicloOrigen: number): number {
  return cicloOrigen + 1
}

export function cicloEscolarEtiqueta(numero: number): string {
  const inicio = numero + 2003
  return `${inicio}-${inicio + 1}`
}

export function toCicloEscolar(numero: number): CicloEscolar {
  const anioInicio = numero + 2003
  return {
    numero,
    etiqueta: `${anioInicio}-${anioInicio + 1}`,
    anioInicio,
    anioFin: anioInicio + 1,
  }
}

/** Lista para &lt;select&gt;: actual ± rango (sin tocar código cada temporada). */
export function getCiclosEscolaresOpciones(
  ref?: Date,
  rangoAtras = 2,
  rangoAdelante = 2
): CicloEscolar[] {
  const actual = getCicloEscolarActual(ref)
  const opciones: CicloEscolar[] = []
  for (let n = actual - rangoAtras; n <= actual + rangoAdelante; n++) {
    if (n > 0) opciones.push(toCicloEscolar(n))
  }
  return opciones
}

/** Opciones de select centradas en un ciclo de temporada (p. ej. `es_actual`). */
export function getCiclosEscolaresOpcionesDesdeBase(
  cicloBase: number,
  rangoAtras = 2,
  rangoAdelante = 2
): CicloEscolar[] {
  const opciones: CicloEscolar[] = []
  for (let n = cicloBase - rangoAtras; n <= cicloBase + rangoAdelante; n++) {
    if (n > 0) opciones.push(toCicloEscolar(n))
  }
  return opciones
}

export function getCicloEscolarDefault(): number {
  const fromEnv = process.env.NEXT_PUBLIC_REPORTES_CICLO_ESCOLAR?.trim()
  if (fromEnv) {
    const n = parseInt(fromEnv, 10)
    if (Number.isInteger(n) && n > 0) return n
  }
  return getCicloEscolarActual()
}
