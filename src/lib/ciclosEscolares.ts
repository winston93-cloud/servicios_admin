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

/** Corte MM-DD del cambio de ciclo administrativo (reinscripciones → año nuevo). */
function corteCambioCicloMmDd(): string {
  return process.env.ADMISIONES_CAMBIO_CICLO?.trim() || '07-25'
}

function mmDd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * cea “natural” por calendario (corte admisiones, default 07-25).
 * Distinto del corte agosto de `getCicloEscolarActual`.
 */
export function cicloEscolarActualPorCorteAdmisiones(ref?: Date): number {
  const d = fechaReferencia(ref)
  const y = d.getFullYear()
  return mmDd(d) < corteCambioCicloMmDd() ? y - 2004 : y - 2003
}

/**
 * Ciclo de inscripción (cen) a partir del cea de catálogo (`es_actual`).
 *
 * - Antes del corte: cen = cea + 1 (p. ej. temporada 22 → reinscripción a 23).
 * - Después del corte: cen = cea (ya estamos en el ciclo nuevo).
 * - Si el catálogo adelantó `es_actual` respecto al calendario (cambio ya
 *   aplicado), cen = cea — evita tratar el ciclo vigente como si fuera el
 *   siguiente año (p. ej. julio 2027).
 */
export function cicloInscripcionDesdeTemporada(cea: number, ref?: Date): number {
  if (!Number.isFinite(cea) || cea <= 0) {
    throw new Error('cea (ciclo de temporada) requerido')
  }
  const d = fechaReferencia(ref)
  const ceaNatural = cicloEscolarActualPorCorteAdmisiones(d)
  if (cea > ceaNatural) return cea
  return mmDd(d) < corteCambioCicloMmDd() ? cea + 1 : cea
}

/**
 * Fallback si no hay catálogo en BD. Preferir
 * `cicloInscripcionDesdeTemporada(es_actual)`.
 */
export function getCicloInscripcion(ref?: Date): number {
  return cicloInscripcionDesdeTemporada(cicloEscolarActualPorCorteAdmisiones(ref), ref)
}

/**
 * Avance de ficha alumno: origen + 1 (22→23, 23→24, …).
 * No usar como cen de temporada; para eso: `cicloInscripcionDesdeTemporada`.
 */
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
