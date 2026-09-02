/**
 * Revisión operativa de inscripción (entrada al colegio).
 * Reusa la misma lógica del portal: 13 = pago único; 11+12 = diferido.
 */
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { getClient, getPaymentConcept } from '@/lib/boucherCore'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  listarPagosColegiaturaAlumno,
  type PagoDetalleRegistro,
} from '@/lib/pagoColegiaturaService'
import { parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
import { alumnoTienePagoSemiref } from '@/lib/portalAdmisionesColegiatura'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import { calcularReinscripcionDiferido } from '@/lib/portalReinscripcionService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export type RevisionInscripcionPlantel = 'educativo' | 'winston'

export type RevisionInscripcionConcepto = '11' | '12' | '13'

export type RevisionInscripcionPagoItem = {
  pago_id: number
  conceptoNo: RevisionInscripcionConcepto
  conceptoClase: string
  referencia: string
  importe: number
  fecha: string | null
  forma: string | null
}

export type RevisionInscripcionModalidad =
  | 'pago_unico'
  | 'diferido_completo'
  | 'diferido_parcial'
  | 'sin_pago'

export type RevisionInscripcionResultado = {
  ok: true
  alumno: {
    alumno_id: number
    alumno_ref: string
    nombre_completo: string
    nivel: number
    nivel_label: string
    grado: number | null
    grado_label: string
    grupo: string | null
    ciclo_ficha: number | null
    es_reinscrito: boolean
    /** Maternal/Kinder = Educativo; Primaria/Secundaria = Winston. */
    plantel: RevisionInscripcionPlantel
    plantel_label: string
    plantel_razon: string
  }
  ciclo_temporada: number
  ciclo_inscripcion: number
  ciclo_label: string
  pagado: boolean
  modalidad: RevisionInscripcionModalidad
  modalidad_label: string
  resumen: string
  /** Concepto que cierra la inscripción completa: 13 o 12. */
  completa_por: RevisionInscripcionConcepto | null
  tiene_dif1: boolean
  tiene_dif2: boolean
  tiene_pago_unico: boolean
  pagos: RevisionInscripcionPagoItem[]
  importe_total: number
  pendiente: number | null
  concepto_pendiente: RevisionInscripcionConcepto | null
}

function plantelDesdeNivel(nivel: number): {
  plantel: RevisionInscripcionPlantel
  label: string
  razon: string
} {
  // Misma regla de baucher: 1–2 Educativo, 3–4 Winston Churchill.
  if (nivel === 1 || nivel === 2) {
    return {
      plantel: 'educativo',
      label: 'Educativo',
      razon: getClient(nivel),
    }
  }
  return {
    plantel: 'winston',
    label: 'Winston',
    razon: getClient(nivel),
  }
}

function nombreCompleto(a: AlumnoRegistro): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function pagoVigente(p: PagoDetalleRegistro): boolean {
  return p.pago_cancelado !== 1 && p.pago_cancelado !== 2
}

function importePago(p: PagoDetalleRegistro): number {
  return Number(p.pago_importe || 0) + Number(p.pago_recargo || 0)
}

function filtrarPagosInscripcion(
  pagos: PagoDetalleRegistro[],
  cen: number
): RevisionInscripcionPagoItem[] {
  const out: RevisionInscripcionPagoItem[] = []
  for (const p of pagos) {
    if (!pagoVigente(p)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cen) continue
    const c = parsed.conceptoNo
    if (c !== '11' && c !== '12' && c !== '13') continue
    out.push({
      pago_id: Number(p.pago_id),
      conceptoNo: c,
      conceptoClase: getPaymentConcept(c),
      referencia: String(p.pago_referencia ?? ''),
      importe: importePago(p),
      fecha: p.pago_fecha ? String(p.pago_fecha).slice(0, 10) : null,
      forma: p.pago_forma ? String(p.pago_forma) : null,
    })
  }
  out.sort((a, b) => {
    const fa = a.fecha || ''
    const fb = b.fecha || ''
    if (fa !== fb) return fa.localeCompare(fb)
    return a.conceptoNo.localeCompare(b.conceptoNo)
  })
  return out
}

function modalidadDesdeFlags(opts: {
  pagado: boolean
  tiene13: boolean
  tiene11: boolean
  tiene12: boolean
}): { modalidad: RevisionInscripcionModalidad; label: string; resumen: string } {
  const { pagado, tiene13, tiene11, tiene12 } = opts
  if (pagado && tiene13) {
    return {
      modalidad: 'pago_unico',
      label: 'Inscripción completa · Pago único',
      resumen:
        'Inscripción completa: pagó el concepto 13 (Inscripción) en un solo pago.',
    }
  }
  if (pagado && tiene12) {
    return {
      modalidad: 'diferido_completo',
      label: 'Inscripción completa · 2º diferido',
      resumen: tiene11
        ? 'Inscripción completa: pagó el concepto 12 (Diferido 2). También tiene Diferido 1.'
        : 'Inscripción completa: pagó el concepto 12 (Diferido 2).',
    }
  }
  if (!pagado && tiene11 && !tiene12) {
    return {
      modalidad: 'diferido_parcial',
      label: 'Incompleta · Solo Diferido 1',
      resumen:
        'Tiene Diferido 1 (11), pero falta el concepto 12 (Diferido 2) para inscripción completa.',
    }
  }
  if (!pagado && (tiene11 || tiene12)) {
    return {
      modalidad: 'diferido_parcial',
      label: 'Diferido incompleto',
      resumen: 'Hay movimientos parciales, pero no cumple inscripción completa (13 o 12).',
    }
  }
  return {
    modalidad: 'sin_pago',
    label: 'Sin inscripción completa',
    resumen:
      'No hay concepto 13 (Inscripción) ni concepto 12 (Diferido 2) pagados en este ciclo.',
  }
}

export async function revisarInscripcionAlumno(
  alumnoId: number
): Promise<RevisionInscripcionResultado | { ok: false; error: string; status: number }> {
  if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
    return { ok: false, error: 'alumnoId es obligatorio.', status: 400 }
  }

  const alumno = await obtenerAlumnoPorId(alumnoId)
  if (!alumno) {
    return { ok: false, error: 'Alumno no encontrado.', status: 404 }
  }

  const cicloSistema = await obtenerCicloEscolarActual()
  if (!cicloSistema) {
    return {
      ok: false,
      error: 'No hay ciclo escolar vigente configurado.',
      status: 503,
    }
  }

  const supabase = createSupabaseAdmin()
  const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
  const calc = esReinscrito
    ? await calcularReinscripcionDiferido(supabase, alumno, cicloSistema.valor)
    : null

  const ciclo = await resolverCicloPagoInscripcionPortal(
    alumno,
    cicloSistema,
    calc?.cicloReinscripcion
  )
  const cen = ciclo.valor
  const pagosCiclo = await listarPagosColegiaturaAlumno(alumno.alumno_id, cen)
  const pagos = filtrarPagosInscripcion(pagosCiclo, cen)

  const tiene13 = alumnoTienePagoSemiref(pagosCiclo, alumno.alumno_ref, '13', cen)
  const tiene11 = alumnoTienePagoSemiref(pagosCiclo, alumno.alumno_ref, '11', cen)
  const tiene12 = alumnoTienePagoSemiref(pagosCiclo, alumno.alumno_ref, '12', cen)
  // Entrada: inscripción completa = concepto 13 (pago único) O concepto 12 (2º diferido).
  const pagado = tiene13 || tiene12
  const completa_por: RevisionInscripcionConcepto | null = tiene13
    ? '13'
    : tiene12
      ? '12'
      : null

  const mod = modalidadDesdeFlags({
    pagado,
    tiene13,
    tiene11,
    tiene12,
  })

  const importe_total = pagos.reduce((s, p) => s + p.importe, 0)
  const pendiente =
    !pagado && calc && typeof calc.monto === 'number' && calc.monto > 0
      ? calc.monto
      : null
  const concepto_pendiente =
    !pagado && calc?.concepto && ['11', '12', '13'].includes(calc.concepto)
      ? (calc.concepto as RevisionInscripcionConcepto)
      : !pagado && !tiene13 && !tiene11 && !tiene12
        ? ('13' as const)
        : !pagado && tiene11 && !tiene12
          ? ('12' as const)
          : null

  const gradoNum =
    alumno.alumno_grado != null && String(alumno.alumno_grado).trim() !== ''
      ? Number(alumno.alumno_grado)
      : null

  const plantelInfo = plantelDesdeNivel(Number(alumno.alumno_nivel))

  return {
    ok: true,
    alumno: {
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: String(alumno.alumno_ref),
      nombre_completo: nombreCompleto(alumno),
      nivel: Number(alumno.alumno_nivel),
      nivel_label: etiquetaNivelEscolar(alumno.alumno_nivel),
      grado: Number.isFinite(gradoNum as number) ? (gradoNum as number) : null,
      grado_label: etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado),
      grupo:
        alumno.alumno_grupo != null && String(alumno.alumno_grupo).trim() !== ''
          ? String(alumno.alumno_grupo)
          : null,
      ciclo_ficha:
        alumno.alumno_ciclo_escolar != null
          ? Number(alumno.alumno_ciclo_escolar)
          : null,
      es_reinscrito: esReinscrito,
      plantel: plantelInfo.plantel,
      plantel_label: plantelInfo.label,
      plantel_razon: plantelInfo.razon,
    },
    ciclo_temporada: cicloSistema.valor,
    ciclo_inscripcion: cen,
    ciclo_label: cicloSistema.nombre || `Ciclo ${cen}`,
    pagado,
    modalidad: mod.modalidad,
    modalidad_label: mod.label,
    resumen: mod.resumen,
    completa_por,
    tiene_dif1: tiene11,
    tiene_dif2: tiene12,
    tiene_pago_unico: tiene13,
    pagos,
    importe_total,
    pendiente,
    concepto_pendiente,
  }
}
