import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { etiquetaPlanMeses } from '@/lib/alumnoPlanMeses'
import { getPaymentConcept, nivelPrecioBoucher } from '@/lib/boucherCore'
import {
  calcularImporteConcepto,
  obtenerPorcentajeBeca,
  obtenerPrecioFila,
} from '@/lib/boucherService'
import { mesDeConcepto } from '@/lib/colegiaturaPrecioReglas'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { normalizarConceptoNo } from '@/lib/pagoReferenciaColegiatura'
import { slotsColegiaturaPortal } from '@/lib/portalPagosCandados'
import {
  resolverPlanMesesParaCiclo,
  type PlanMeses,
} from '@/lib/portalPlanMesesCiclo'

/** Monto mensual por defecto según reglamento (cargo extra horario extendido). */
export const CARGO_EXTRA_MONTO_DEFAULT = 300

export type AlumnoCargoExtraRegistro = {
  alumno_id: number
  ciclo_valor: number
  monto: number
  activo: boolean
  activado_en: string
  desactivado_en: string | null
  desactivado_motivo: string | null
  activado_por: string | null
}

export type VistaPreviaConceptoCargoExtra = {
  conceptoNo: string
  etiqueta: string
  importeBase: number
  cargoExtra: number
  importeTotal: number
}

export type EstadoCargoExtra = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: PlanMeses
  planEtiqueta: string
  activo: boolean
  monto: number
  activadoEn: string | null
  desactivadoEn: string | null
  desactivadoMotivo: string | null
  activadoPor: string | null
  conceptosAfectados: string[]
  incrementoMensual: number
  puedeActivar: boolean
  puedeDesactivar: boolean
  vistaPrevia: VistaPreviaConceptoCargoExtra[]
  registro: AlumnoCargoExtraRegistro | null
}

function nombreAlumno(
  a: Pick<AlumnoRegistro, 'alumno_nombre' | 'alumno_app' | 'alumno_apm'>
): string {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ').trim()
}

/** Colegiaturas mensuales donde aplica el cargo extra (01–10, 26). */
export function conceptoAplicaCargoExtra(conceptoNo: string): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  if (c === '00' || c === '16' || c === '30' || c === '31') return false
  return mesDeConcepto(c) != null
}

export function conceptosColegiaturaCargoExtra(planMeses: PlanMeses): string[] {
  const out: string[] = []
  for (const slot of slotsColegiaturaPortal(planMeses)) {
    for (const raw of slot) {
      const c = normalizarConceptoNo(raw)
      if (conceptoAplicaCargoExtra(c)) out.push(c)
    }
  }
  return out
}

export function montoCargoExtraRegistro(
  reg: Pick<AlumnoCargoExtraRegistro, 'activo' | 'monto'> | null | undefined
): number {
  if (!reg?.activo) return 0
  const m = Number(reg.monto)
  return m > 0 ? m : CARGO_EXTRA_MONTO_DEFAULT
}

/** Suma cargo extra al importe ya calculado (beca/prórroga no lo reducen). */
export function aplicarCargoExtraImporte(
  importe: number,
  conceptoNo: string,
  reg: Pick<AlumnoCargoExtraRegistro, 'activo' | 'monto'> | null | undefined
): number {
  if (!reg?.activo || !conceptoAplicaCargoExtra(conceptoNo)) return importe
  const extra = montoCargoExtraRegistro(reg)
  return Math.round((importe + extra) * 100) / 100
}

export async function obtenerRegistroCargoExtra(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<AlumnoCargoExtraRegistro | null> {
  const { data, error } = await db
    .from('alumno_cargo_extra')
    .select(
      'alumno_id, ciclo_valor, monto, activo, activado_en, desactivado_en, desactivado_motivo, activado_por'
    )
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) {
    console.warn('obtenerRegistroCargoExtra:', error.message)
    return null
  }
  if (!data) return null
  return {
    ...data,
    monto: Number(data.monto) || CARGO_EXTRA_MONTO_DEFAULT,
  } as AlumnoCargoExtraRegistro
}

export async function obtenerCargoExtraActivo(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<AlumnoCargoExtraRegistro | null> {
  const reg = await obtenerRegistroCargoExtra(db, alumnoId, cicloValor)
  return reg?.activo ? reg : null
}

async function construirVistaPrevia(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  planMeses: PlanMeses,
  reg: AlumnoCargoExtraRegistro | null,
  montoCargo: number
): Promise<VistaPreviaConceptoCargoExtra[]> {
  const nivelPrecio = nivelPrecioBoucher(
    alumno.alumno_nivel,
    Number(alumno.alumno_grado) || 0
  )
  const precio = await obtenerPrecioFila(db, nivelPrecio, cicloValor)
  if (!precio) return []

  const becaPct = await obtenerPorcentajeBeca(db, alumno.alumno_id, cicloValor)
  const conceptos = conceptosColegiaturaCargoExtra(planMeses)
  const regPreview: AlumnoCargoExtraRegistro = {
    alumno_id: alumno.alumno_id,
    ciclo_valor: cicloValor,
    monto: montoCargo,
    activo: true,
    activado_en: reg?.activado_en ?? new Date().toISOString(),
    desactivado_en: null,
    desactivado_motivo: null,
    activado_por: reg?.activado_por ?? null,
  }

  return conceptos.map((conceptoNo) => {
    const importeBase = calcularImporteConcepto(conceptoNo, precio, becaPct, planMeses, {
      alumnoRef: alumno.alumno_ref,
      cicloEscolar: cicloValor,
    })
    const importeTotal = aplicarCargoExtraImporte(importeBase, conceptoNo, regPreview)
    const etiqueta = getPaymentConcept(conceptoNo)
    return {
      conceptoNo,
      etiqueta: etiqueta !== '-None-' ? etiqueta : conceptoNo,
      importeBase,
      cargoExtra: montoCargo,
      importeTotal,
    }
  })
}

export async function consultarEstadoCargoExtra(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<EstadoCargoExtra> {
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const planMeses = await resolverPlanMesesParaCiclo(db, alumno, cicloValor, pagos)
  const reg = await obtenerRegistroCargoExtra(db, alumno.alumno_id, cicloValor)
  const activo = Boolean(reg?.activo)
  const monto = reg?.monto ?? CARGO_EXTRA_MONTO_DEFAULT
  const conceptosAfectados = conceptosColegiaturaCargoExtra(planMeses)
  const vistaPrevia = await construirVistaPrevia(
    db,
    alumno,
    cicloValor,
    planMeses,
    reg,
    monto
  )

  return {
    alumnoId: alumno.alumno_id,
    alumnoRef: String(alumno.alumno_ref),
    nombre: nombreAlumno(alumno),
    cicloValor,
    planMeses,
    planEtiqueta: etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`,
    activo,
    monto,
    activadoEn: reg?.activado_en ?? null,
    desactivadoEn: reg?.desactivado_en ?? null,
    desactivadoMotivo: reg?.desactivado_motivo ?? null,
    activadoPor: reg?.activado_por ?? null,
    conceptosAfectados,
    incrementoMensual: monto,
    puedeActivar: !activo,
    puedeDesactivar: activo,
    vistaPrevia,
    registro: reg,
  }
}

export async function activarCargoExtra(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  opts?: { monto?: number; activadoPor?: string | null }
): Promise<{ ok: true; estado: EstadoCargoExtra } | { ok: false; error: string }> {
  const monto =
    opts?.monto != null && Number(opts.monto) > 0
      ? Math.round(Number(opts.monto) * 100) / 100
      : CARGO_EXTRA_MONTO_DEFAULT
  const ahora = new Date().toISOString()

  const { error } = await db.from('alumno_cargo_extra').upsert(
    [
      {
        alumno_id: alumno.alumno_id,
        ciclo_valor: cicloValor,
        monto,
        activo: true,
        activado_en: ahora,
        desactivado_en: null,
        desactivado_motivo: null,
        activado_por: opts?.activadoPor?.trim() || null,
        actualizado_en: ahora,
      },
    ],
    { onConflict: 'alumno_id,ciclo_valor' }
  )

  if (error) {
    return { ok: false, error: error.message }
  }

  const estado = await consultarEstadoCargoExtra(db, alumno, cicloValor)
  return { ok: true, estado }
}

export async function desactivarCargoExtra(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  motivo?: string | null
): Promise<{ ok: true; estado: EstadoCargoExtra } | { ok: false; error: string }> {
  const reg = await obtenerRegistroCargoExtra(db, alumno.alumno_id, cicloValor)
  if (!reg?.activo) {
    return { ok: false, error: 'El alumno no tiene cargo extra activo en este ciclo.' }
  }

  const ahora = new Date().toISOString()
  const { error } = await db
    .from('alumno_cargo_extra')
    .update({
      activo: false,
      desactivado_en: ahora,
      desactivado_motivo: motivo?.trim() || 'Desactivado desde Servicios.',
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', cicloValor)

  if (error) {
    return { ok: false, error: error.message }
  }

  const estado = await consultarEstadoCargoExtra(db, alumno, cicloValor)
  return { ok: true, estado }
}
