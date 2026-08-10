import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'

export function pagoVigente(cancelado: number | null): boolean {
  return cancelado !== 1 && cancelado !== 2
}

export function pagosAlumnoVigentes<
  T extends { pago_cancelado: number | null },
>(pagos: T[]): T[] {
  return pagos.filter((p) => pagoVigente(p.pago_cancelado))
}

export function formatearFechaPago(fecha: string | null): string {
  if (!fecha) return ''
  const d = fecha.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return fecha
  return `${day}/${m}/${y}`
}

function fechasConceptoCiclo(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }[],
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number
): string[] {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  return pagos
    .filter((p) => pagoVigente(p.pago_cancelado))
    .map((p) => {
      const parsed = parsearReferenciaPago(p.pago_referencia)
      if (!parsed) return null
      if (
        parsed.alumnoRef !== ref5 ||
        !conceptos.includes(normalizarConceptoNo(parsed.conceptoNo)) ||
        parsed.cicloEscolar !== cicloInscripcion
      ) {
        return null
      }
      return p.pago_fecha
    })
    .filter((f): f is string => Boolean(f))
    .sort()
}

export function buscarFechaConcepto(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }[],
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number
): string {
  const hits = fechasConceptoCiclo(pagos, alumnoRef, conceptos, cicloInscripcion)
  return hits.length ? formatearFechaPago(hits[0]) : ''
}

/** Primera fecha de pago del concepto dentro del rango calendario (YYYY-MM-DD…). */
export function buscarFechaConceptoEnRango(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }[],
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number,
  rango: { desde: string; hasta: string }
): string {
  const desde = rango.desde.slice(0, 10)
  const hasta = rango.hasta.slice(0, 10)
  const hits = fechasConceptoCiclo(pagos, alumnoRef, conceptos, cicloInscripcion).filter(
    (f) => {
      const d = f.slice(0, 10)
      return d >= desde && d <= hasta
    }
  )
  return hits.length ? formatearFechaPago(hits[0]) : ''
}

export function tieneConceptoEnCiclo(
  pagos: {
    pago_referencia: string | null
    pago_cancelado: number | null
  }[],
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number
): boolean {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  return pagos.some((p) => {
    if (!pagoVigente(p.pago_cancelado)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      parsed.alumnoRef === ref5 &&
      conceptos.includes(normalizarConceptoNo(parsed.conceptoNo)) &&
      parsed.cicloEscolar === cicloInscripcion
    )
  })
}

export function pagosConceptoBloque(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_importe: number | null
    pago_cancelado: number | null
  }[],
  alumnoRef: string,
  conceptos: string[],
  ciclo: number
): { fecha: string; concepto: string; importe: string }[] {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  return pagos
    .filter((p) => pagoVigente(p.pago_cancelado))
    .map((p) => {
      const parsed = parsearReferenciaPago(p.pago_referencia)
      if (!parsed) return null
      if (
        parsed.alumnoRef !== ref5 ||
        !conceptos.includes(normalizarConceptoNo(parsed.conceptoNo)) ||
        parsed.cicloEscolar !== ciclo
      ) {
        return null
      }
      const imp = p.pago_importe == null ? '' : String(p.pago_importe)
      return {
        fecha: formatearFechaPago(p.pago_fecha),
        concepto: parsed.conceptoNo,
        importe: imp,
      }
    })
    .filter((x): x is { fecha: string; concepto: string; importe: string } => x != null)
}
