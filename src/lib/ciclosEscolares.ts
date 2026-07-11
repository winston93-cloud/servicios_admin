/**
 * Ciclos escolares Winston (numérico: 22 = 2025-2026).
 * Misma lógica que reportes/index.php del portal PHP legacy.
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

/** Ciclo escolar en curso según mes (corte agosto). */
export function getCicloEscolarActual(ref?: Date): number {
  const d = fechaReferencia(ref)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return m < 8 ? y - 2004 : y - 2003
}

/** Ciclo de inscripción / reinscripción hacia el siguiente año escolar. */
export function getCicloInscripcion(ref?: Date): number {
  const d = fechaReferencia(ref)
  const cmd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const y = d.getFullYear() % 100
  const cambioCiclo = process.env.ADMISIONES_CAMBIO_CICLO?.trim() || '07-25'
  const cea = cmd < cambioCiclo ? y - 4 : y - 3
  return cmd < cambioCiclo ? cea + 1 : cea
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

/** Lista para &lt;select&gt;: actual ± rango (sin tocar código cada agosto). */
export function getCiclosEscolaresOpciones(
  ref?: Date,
  rangoAtras = 2,
  rangoAdelante = 1
): CicloEscolar[] {
  const actual = getCicloEscolarActual(ref)
  const opciones: CicloEscolar[] = []
  for (let n = actual - rangoAtras; n <= actual + rangoAdelante; n++) {
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
