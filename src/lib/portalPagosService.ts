import { obtenerAlumnoPorId, type AlumnoRegistro } from './alumnoDatosService'
import {
  obtenerCicloEscolarActual,
  type CicloEscolarRegistro,
} from './ciclosEscolaresService'
import {
  conceptoClasePorReferencia,
  listarConceptosBoucher,
  listarPagosColegiaturaAlumno,
  type ConceptoBoucher,
  type PagoDetalleRegistro,
} from './pagoColegiaturaService'
import { parsearReferenciaPago, normalizarConceptoNo } from './pagoReferenciaColegiatura'

export interface PortalPagosContexto {
  ciclo: CicloEscolarRegistro
  alumno: AlumnoRegistro
  pagos: PagoDetalleRegistro[]
  conceptos: ConceptoBoucher[]
}

export function formatearMontoPortal(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function etiquetaConceptoPago(
  referencia: string | null | undefined,
  conceptos: ConceptoBoucher[]
): string {
  return conceptoClasePorReferencia(referencia, conceptos)
}

export function etiquetaEstatusAlumno(pago_cancelado: number): string | null {
  switch (pago_cancelado) {
    case 1:
      return 'Cancelado'
    case 2:
      return 'Devolución'
    case 3:
      return 'Registro manual'
    default:
      return null
  }
}

function ordenarPagosPortal(pagos: PagoDetalleRegistro[]): PagoDetalleRegistro[] {
  return [...pagos].sort((a, b) => {
    const ca = normalizarConceptoNo(parsearReferenciaPago(a.pago_referencia)?.conceptoNo)
    const cb = normalizarConceptoNo(parsearReferenciaPago(b.pago_referencia)?.conceptoNo)
    const cmp = parseInt(ca, 10) - parseInt(cb, 10)
    if (cmp !== 0) return cmp
    const fa = a.pago_fecha ?? ''
    const fb = b.pago_fecha ?? ''
    if (fa !== fb) return fb.localeCompare(fa)
    return b.pago_id - a.pago_id
  })
}

export async function cargarPortalPagosAlumno(
  alumnoId: number
): Promise<{ ok: true; data: PortalPagosContexto } | { ok: false; error: string }> {
  const ciclo = await obtenerCicloEscolarActual()
  if (!ciclo) {
    return {
      ok: false,
      error:
        'No hay un ciclo escolar marcado como vigente en el sistema. Contacta a servicios escolares.',
    }
  }

  const alumno = await obtenerAlumnoPorId(alumnoId)
  if (!alumno) {
    return { ok: false, error: 'No se encontró el registro del alumno.' }
  }

  const [conceptos, pagosRaw] = await Promise.all([
    listarConceptosBoucher(),
    listarPagosColegiaturaAlumno(alumnoId, ciclo.valor),
  ])

  const pagos = ordenarPagosPortal(pagosRaw)

  return {
    ok: true,
    data: { ciclo, alumno, pagos, conceptos },
  }
}

export function totalPagosVigentes(pagos: PagoDetalleRegistro[]): number {
  return pagos
    .filter((p) => p.pago_cancelado === 0)
    .reduce((s, p) => s + p.pago_importe + p.pago_recargo, 0)
}
