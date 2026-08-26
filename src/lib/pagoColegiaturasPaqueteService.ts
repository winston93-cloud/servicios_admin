import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { etiquetaPlanMeses } from '@/lib/alumnoPlanMeses'
import {
  getDigVerif,
  getPaymentConcept,
  referenciaSemibase,
  nivelPrecioBoucher,
} from '@/lib/boucherCore'
import {
  calcularImporteConcepto,
  obtenerPorcentajeBeca,
  obtenerPrecioFila,
} from '@/lib/boucherService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { alumnoTienePagoAnualPendiente } from '@/lib/pagoAnualService'
import { slotsColegiaturaPortal } from '@/lib/portalPagosCandados'
import {
  resolverPlanMesesParaCiclo,
  type PlanMeses,
} from '@/lib/portalPlanMesesCiclo'
import {
  aplicarCargoExtraImporte,
  obtenerCargoExtraActivo,
} from '@/lib/alumnoCargoExtraService'

/** Concepto boucher: Pagos de Colegiaturas (referencia dígitos 6–7). */
export const CONCEPTO_PAGO_COLEGIATURAS = '31'

const FORMA_CUBIERTA = 'Pagos de Colegiaturas'
const NOMBRE_CUBIERTA = 'Colegiatura cubierta por Pagos de Colegiaturas (importe 0)'

export type MesColegiaturaAdeudo = {
  conceptoNo: string
  etiqueta: string
  monto: number
  pagado: boolean
}

export type AlumnoPagoColegiaturasRegistro = {
  alumno_id: number
  ciclo_valor: number
  plan_meses: PlanMeses
  conceptos: string[]
  monto: number
  activo: boolean
  pagado: boolean
  activado_en: string
  pagado_en: string | null
  desactivado_en: string | null
  desactivado_motivo: string | null
}

export type EstadoPagoColegiaturasPaquete = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: PlanMeses
  planEtiqueta: string
  meses: MesColegiaturaAdeudo[]
  montoTotal: number
  conceptosAsignados: string[]
  activo: boolean
  pagado: boolean
  puedeActivar: boolean
  puedeRevertir: boolean
  bloqueadoPorAnual: boolean
  registro: AlumnoPagoColegiaturasRegistro | null
}

export function conceptosColegiaturaDelPlan(planMeses: PlanMeses): string[] {
  const out: string[] = []
  for (const slot of slotsColegiaturaPortal(planMeses)) {
    for (const raw of slot) {
      const c = normalizarConceptoNo(raw)
      if (c === '00' || c === '16') continue
      out.push(c)
    }
  }
  return out
}

export function etiquetaPagoColegiaturas(): string {
  const canon = getPaymentConcept(CONCEPTO_PAGO_COLEGIATURAS)
  return canon !== '-None-' ? canon : 'Pagos de Colegiaturas'
}

export function etiquetaMesesPaquete(conceptos: string[]): string {
  const meses = conceptos
    .map((c) => getPaymentConcept(normalizarConceptoNo(c)))
    .filter((t) => t && t !== '-None-')
  if (!meses.length) return etiquetaPagoColegiaturas()
  return `Pago Colegiaturas (${meses.join(', ')})`
}

function nombreAlumno(
  a: Pick<AlumnoRegistro, 'alumno_nombre' | 'alumno_app' | 'alumno_apm'>
): string {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ').trim()
}

function normalizarListaConceptos(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of arr) {
    const c = normalizarConceptoNo(String(item ?? ''))
    if (!c || seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

function pagoVigenteConcepto(
  pagos: Awaited<ReturnType<typeof listarPagosColegiaturaAlumno>>,
  conceptoNo: string,
  cicloValor: number
): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  return pagos.some((p) => {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) return false
    if (!(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloValor) return false
    return normalizarConceptoNo(parsed.conceptoNo) === c
  })
}

export async function obtenerRegistroPagoColegiaturas(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<AlumnoPagoColegiaturasRegistro | null> {
  const { data, error } = await db
    .from('alumno_pago_colegiaturas')
    .select(
      'alumno_id, ciclo_valor, plan_meses, conceptos, monto, activo, pagado, activado_en, pagado_en, desactivado_en, desactivado_motivo'
    )
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) {
    console.warn('obtenerRegistroPagoColegiaturas:', error.message)
    return null
  }
  if (!data) return null
  return {
    ...data,
    plan_meses: (Number(data.plan_meses) === 2 ? 2 : 1) as PlanMeses,
    conceptos: normalizarListaConceptos(data.conceptos),
    monto: Number(data.monto) || 0,
  } as AlumnoPagoColegiaturasRegistro
}

export async function alumnoTienePaqueteColegiaturasPendiente(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<boolean> {
  const reg = await obtenerRegistroPagoColegiaturas(db, alumnoId, cicloValor)
  return Boolean(reg?.activo && !reg.pagado)
}

async function montosPorConcepto(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  planMeses: PlanMeses,
  conceptos: string[]
): Promise<Map<string, number>> {
  const nivelPrecio = nivelPrecioBoucher(
    alumno.alumno_nivel,
    Number(alumno.alumno_grado) || 0
  )
  const precio = await obtenerPrecioFila(db, nivelPrecio, cicloValor)
  if (!precio) {
    throw new Error(`No hay precios configurados para el nivel en el ciclo ${cicloValor}.`)
  }
  const becaPct = await obtenerPorcentajeBeca(db, alumno.alumno_id, cicloValor)
  const cargoExtraReg = await obtenerCargoExtraActivo(db, alumno.alumno_id, cicloValor)
  const map = new Map<string, number>()
  for (const c of conceptos) {
    let monto = calcularImporteConcepto(c, precio, becaPct, planMeses, {
      alumnoRef: alumno.alumno_ref,
      cicloEscolar: cicloValor,
      fecha: new Date(),
    })
    monto = aplicarCargoExtraImporte(monto, c, cargoExtraReg)
    map.set(c, Math.round(monto * 100) / 100)
  }
  return map
}

export async function consultarEstadoPagoColegiaturasPaquete(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<EstadoPagoColegiaturasPaquete> {
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const planMeses = await resolverPlanMesesParaCiclo(db, alumno, cicloValor, pagos)
  const delPlan = conceptosColegiaturaDelPlan(planMeses)
  const montos = await montosPorConcepto(db, alumno, cicloValor, planMeses, delPlan)
  const reg = await obtenerRegistroPagoColegiaturas(db, alumno.alumno_id, cicloValor)
  const bloqueadoPorAnual = await alumnoTienePagoAnualPendiente(
    db,
    alumno.alumno_id,
    cicloValor
  )

  const meses: MesColegiaturaAdeudo[] = delPlan.map((conceptoNo) => ({
    conceptoNo,
    etiqueta: getPaymentConcept(conceptoNo),
    monto: montos.get(conceptoNo) ?? 0,
    pagado: pagoVigenteConcepto(pagos, conceptoNo, cicloValor),
  }))

  const activo = Boolean(reg?.activo)
  const pagado = Boolean(reg?.pagado)
  const conceptosAsignados = activo || pagado ? (reg?.conceptos ?? []) : []
  const montoTotal = conceptosAsignados.length
    ? conceptosAsignados.reduce((acc, c) => acc + (montos.get(c) ?? 0), 0)
    : 0

  return {
    alumnoId: alumno.alumno_id,
    alumnoRef: String(alumno.alumno_ref),
    nombre: nombreAlumno(alumno),
    cicloValor,
    planMeses,
    planEtiqueta: etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`,
    meses,
    montoTotal: Math.round(montoTotal * 100) / 100,
    conceptosAsignados,
    activo,
    pagado,
    bloqueadoPorAnual,
    puedeActivar: !bloqueadoPorAnual && !activo && !pagado,
    puedeRevertir: Boolean(reg && activo && !pagado),
    registro: reg,
  }
}

export async function activarPagoColegiaturasPaquete(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  conceptosRaw: string[]
): Promise<
  { ok: true; estado: EstadoPagoColegiaturasPaquete } | { ok: false; error: string }
> {
  const estado = await consultarEstadoPagoColegiaturasPaquete(db, alumno, cicloValor)
  if (estado.bloqueadoPorAnual) {
    return {
      ok: false,
      error: 'El alumno tiene pago anual activo. Desactívalo antes de armar este paquete.',
    }
  }
  if (estado.pagado) {
    return { ok: false, error: 'Este paquete ya está cobrado. No se puede reasignar.' }
  }
  if (estado.activo) {
    return { ok: false, error: 'Ya hay un paquete activo. Revierte primero si quieres cambiar meses.' }
  }

  const permitidos = new Set(
    estado.meses.filter((m) => !m.pagado).map((m) => m.conceptoNo)
  )
  const conceptos = normalizarListaConceptos(conceptosRaw).filter((c) => permitidos.has(c))
  if (conceptos.length === 0) {
    return { ok: false, error: 'Elige al menos una colegiatura pendiente.' }
  }

  const monto = Math.round(
    conceptos.reduce((acc, c) => acc + (estado.meses.find((m) => m.conceptoNo === c)?.monto ?? 0), 0) *
      100
  ) / 100

  const ahora = new Date().toISOString()
  const fila = {
    alumno_id: alumno.alumno_id,
    ciclo_valor: cicloValor,
    plan_meses: estado.planMeses,
    conceptos,
    monto,
    activo: true,
    pagado: false,
    activado_en: ahora,
    pagado_en: null,
    desactivado_en: null,
    desactivado_motivo: null,
    actualizado_en: ahora,
  }

  const { error } = await db.from('alumno_pago_colegiaturas').upsert(fila, {
    onConflict: 'alumno_id,ciclo_valor',
  })
  if (error) {
    return { ok: false, error: error.message || 'No se pudo asignar el paquete.' }
  }

  return {
    ok: true,
    estado: await consultarEstadoPagoColegiaturasPaquete(db, alumno, cicloValor),
  }
}

export async function revertirPagoColegiaturasPaquete(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  motivo = 'Revertido desde Servicios (aún sin cobro).'
): Promise<
  { ok: true; estado: EstadoPagoColegiaturasPaquete } | { ok: false; error: string }
> {
  const reg = await obtenerRegistroPagoColegiaturas(db, alumno.alumno_id, cicloValor)
  if (!reg) return { ok: false, error: 'No hay paquete de colegiaturas para este alumno.' }
  if (reg.pagado) {
    return { ok: false, error: 'El paquete ya está pagado; no se puede revertir.' }
  }

  const ahora = new Date().toISOString()
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)

  for (const p of pagos) {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloValor) continue
    if (normalizarConceptoNo(parsed.conceptoNo) !== CONCEPTO_PAGO_COLEGIATURAS) continue
    if (Number(p.pago_importe) > 0) continue

    await db
      .from('pago_detalle')
      .update({ pago_cancelado: 1, pago_actualizacion: ahora })
      .eq('pago_id', p.pago_id)
  }

  const { error } = await db
    .from('alumno_pago_colegiaturas')
    .update({
      activo: false,
      pagado: false,
      pagado_en: null,
      desactivado_en: ahora,
      desactivado_motivo: motivo,
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', cicloValor)

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    estado: await consultarEstadoPagoColegiaturasPaquete(db, alumno, cicloValor),
  }
}

async function siguientePagoId(db: AppDatabaseClient): Promise<number> {
  const { data } = await db
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (Number((data as { pago_id?: number } | null)?.pago_id) || 0) + 1
}

export async function aplicarCoberturaTrasPagoColegiaturas(
  db: AppDatabaseClient,
  alumno: Pick<AlumnoRegistro, 'alumno_id' | 'alumno_ref' | 'mes'>,
  cicloValor: number,
  opts?: { fechaPago?: string; importePagado?: number }
): Promise<{ ok: true; insertados: string[] } | { ok: false; error: string }> {
  const reg = await obtenerRegistroPagoColegiaturas(db, alumno.alumno_id, cicloValor)
  if (!reg?.activo) {
    return { ok: false, error: 'No hay paquete de colegiaturas activo.' }
  }

  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const fechaPago = opts?.fechaPago ?? new Date().toISOString().slice(0, 10)
  const ahora = new Date().toISOString()
  const hora = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const insertados: string[] = []
  let pagoId = await siguientePagoId(db)

  for (const concepto of reg.conceptos) {
    const ya = pagos.some((p) => {
      if (p.pago_cancelado === 1 || p.pago_cancelado === 2) return false
      const parsed = parsearReferenciaPago(p.pago_referencia)
      return (
        parsed != null &&
        parsed.cicloEscolar === cicloValor &&
        normalizarConceptoNo(parsed.conceptoNo) === concepto
      )
    })
    if (ya) continue

    const referencia = getDigVerif(0, referenciaSemibase(alumno.alumno_ref, concepto, cicloValor))
    const fila = {
      pago_id: pagoId,
      alumno_id: alumno.alumno_id,
      pago_nombre: NOMBRE_CUBIERTA,
      pago_referencia: referencia,
      pago_importe: 0,
      pago_recargo: 0,
      pago_forma: FORMA_CUBIERTA,
      pago_folio: null,
      pago_fecha: fechaPago,
      pago_hora: hora,
      pago_emisora: 'S/E',
      pago_cancelado: 3,
      pago_registro: ahora,
      pago_actualizacion: ahora,
      facturo: '',
      fact: '',
    }

    const { error } = await db.from('pago_detalle').insert(fila)
    if (error) {
      console.error('aplicarCoberturaTrasPagoColegiaturas:', concepto, error.message)
      pagoId = await siguientePagoId(db)
      const retry = await db.from('pago_detalle').insert({ ...fila, pago_id: pagoId })
      if (retry.error) continue
    }
    insertados.push(concepto)
    pagoId += 1
  }

  const { error: updErr } = await db
    .from('alumno_pago_colegiaturas')
    .update({
      pagado: true,
      pagado_en: ahora,
      activo: true,
      monto: opts?.importePagado != null ? opts.importePagado : reg.monto,
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', cicloValor)

  if (updErr) return { ok: false, error: updErr.message }
  return { ok: true, insertados }
}

export async function descripcionFacturaPagoColegiaturas(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<string | null> {
  const reg = await obtenerRegistroPagoColegiaturas(db, alumnoId, cicloValor)
  if (!reg?.conceptos?.length) return null
  return etiquetaMesesPaquete(reg.conceptos)
}
