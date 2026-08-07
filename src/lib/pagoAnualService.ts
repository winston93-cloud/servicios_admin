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
  montoBaseConcepto,
  obtenerPorcentajeBeca,
  obtenerPrecioFila,
} from '@/lib/boucherService'
import { anioCalendarioConcepto } from '@/lib/colegiaturaPrecioReglas'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { slotsColegiaturaPortal } from '@/lib/portalPagosCandados'
import { planMesesNormalizado } from '@/lib/portalPlanPagosConfirmado'
import {
  resolverPlanMesesParaCiclo,
  type PlanMeses,
} from '@/lib/portalPlanMesesCiclo'

/** Concepto boucher: Pago Anual (referencia dígitos 6–7). */
export const CONCEPTO_PAGO_ANUAL = '30'

const DESCUENTO_PAGO_ANUAL = 0.05
const FORMA_CUBIERTA = 'Pago Anual'
const NOMBRE_CUBIERTA = 'Colegiatura cubierta por Pago Anual (importe 0)'

export type AlumnoPagoAnualRegistro = {
  alumno_id: number
  ciclo_valor: number
  plan_meses: PlanMeses
  monto: number
  activo: boolean
  pagado: boolean
  vencimiento: string
  activado_en: string
  pagado_en: string | null
  desactivado_en: string | null
  desactivado_motivo: string | null
}

export type EstadoPagoAnual = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: PlanMeses
  planEtiqueta: string
  montoLista: number
  montoConDescuento: number
  descuentoPct: number
  conceptosCubiertos: string[]
  bloqueadoPorPagos: boolean
  puedeActivar: boolean
  activo: boolean
  pagado: boolean
  vencimiento: string | null
  vencido: boolean
  registro: AlumnoPagoAnualRegistro | null
}

/** Colegiaturas cubiertas por el plan (sin cuota 00 ni material 16). */
export function conceptosColegiaturaPagoAnual(planMeses: PlanMeses): string[] {
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

export function vencimientoPagoAnual(cicloValor: number): string {
  const anio = anioCalendarioConcepto('00', cicloValor) ?? cicloValor + 2003
  return `${anio}-08-15`
}

function nombreAlumno(a: Pick<AlumnoRegistro, 'alumno_nombre' | 'alumno_app' | 'alumno_apm'>): string {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ').trim()
}

function hoyIsoFecha(fecha = new Date()): string {
  return fecha.toISOString().slice(0, 10)
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

export async function obtenerRegistroPagoAnual(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<AlumnoPagoAnualRegistro | null> {
  const { data, error } = await db
    .from('alumno_pago_anual')
    .select(
      'alumno_id, ciclo_valor, plan_meses, monto, activo, pagado, vencimiento, activado_en, pagado_en, desactivado_en, desactivado_motivo'
    )
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) {
    console.warn('obtenerRegistroPagoAnual:', error.message)
    return null
  }
  if (!data) return null
  return {
    ...data,
    plan_meses: planMesesNormalizado(data.plan_meses),
    monto: Number(data.monto) || 0,
  } as AlumnoPagoAnualRegistro
}

/**
 * Si venció el 15 ago sin pagar: desactiva y deja el portal en plan mensual normal.
 */
export async function asegurarVigenciaPagoAnual(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number,
  fecha = new Date()
): Promise<AlumnoPagoAnualRegistro | null> {
  const reg = await obtenerRegistroPagoAnual(db, alumnoId, cicloValor)
  if (!reg) return null
  if (!reg.activo || reg.pagado) return reg

  if (hoyIsoFecha(fecha) <= reg.vencimiento) return reg

  const ahora = new Date().toISOString()
  const { error } = await db
    .from('alumno_pago_anual')
    .update({
      activo: false,
      desactivado_en: ahora,
      desactivado_motivo: 'Venció el 15 de agosto sin pago; se restaura plan mensual.',
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)

  if (error) {
    console.error('asegurarVigenciaPagoAnual:', error.message)
    return reg
  }

  return {
    ...reg,
    activo: false,
    desactivado_en: ahora,
    desactivado_motivo: 'Venció el 15 de agosto sin pago; se restaura plan mensual.',
  }
}

export async function calcularMontoPagoAnual(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  planMeses: PlanMeses
): Promise<{ montoLista: number; montoConDescuento: number; conceptos: string[] }> {
  const nivelPrecio = nivelPrecioBoucher(
    alumno.alumno_nivel,
    Number(alumno.alumno_grado) || 0
  )
  const precio = await obtenerPrecioFila(db, nivelPrecio, cicloValor)
  if (!precio) {
    throw new Error(`No hay precios configurados para el nivel en el ciclo ${cicloValor}.`)
  }

  const becaPct = await obtenerPorcentajeBeca(db, alumno.alumno_id, cicloValor)
  const conceptos = conceptosColegiaturaPagoAnual(planMeses)
  let montoLista = 0
  for (const c of conceptos) {
    // Lista con beca Winston/SEP si aplica (mismo criterio que el portal mensual).
    montoLista += calcularImporteConcepto(c, precio, becaPct, planMeses, {
      alumnoRef: alumno.alumno_ref,
      cicloEscolar: cicloValor,
      fecha: new Date(`${vencimientoPagoAnual(cicloValor)}T12:00:00`),
    })
  }
  montoLista = Math.round(montoLista * 100) / 100
  const montoConDescuento =
    Math.round(montoLista * (1 - DESCUENTO_PAGO_ANUAL) * 100) / 100
  return { montoLista, montoConDescuento, conceptos }
}

export async function consultarEstadoPagoAnual(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<EstadoPagoAnual> {
  const reg = await asegurarVigenciaPagoAnual(db, alumno.alumno_id, cicloValor)
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const planMeses = await resolverPlanMesesParaCiclo(db, alumno, cicloValor, pagos)
  const { montoLista, montoConDescuento, conceptos } = await calcularMontoPagoAnual(
    db,
    alumno,
    cicloValor,
    planMeses
  )

  const bloqueadoPorPagos = conceptos.some((c) =>
    pagoVigenteConcepto(pagos, c, cicloValor)
  )
  const vencimiento = reg?.vencimiento ?? vencimientoPagoAnual(cicloValor)
  const vencido = hoyIsoFecha() > vencimiento
  const activo = Boolean(reg?.activo)
  const pagado = Boolean(reg?.pagado)

  return {
    alumnoId: alumno.alumno_id,
    alumnoRef: String(alumno.alumno_ref),
    nombre: nombreAlumno(alumno),
    cicloValor,
    planMeses,
    planEtiqueta: etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`,
    montoLista,
    montoConDescuento,
    descuentoPct: DESCUENTO_PAGO_ANUAL * 100,
    conceptosCubiertos: conceptos,
    bloqueadoPorPagos,
    puedeActivar: !bloqueadoPorPagos && !pagado && !vencido && !activo,
    activo,
    pagado,
    vencimiento,
    vencido,
    registro: reg,
  }
}

export async function activarPagoAnual(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<{ ok: true; estado: EstadoPagoAnual } | { ok: false; error: string }> {
  const estado = await consultarEstadoPagoAnual(db, alumno, cicloValor)
  if (estado.pagado) {
    return { ok: false, error: 'El pago anual de este ciclo ya está pagado.' }
  }
  if (estado.bloqueadoPorPagos) {
    return {
      ok: false,
      error:
        'Ya hay colegiaturas pagadas (septiembre–junio/julio). No se puede activar pago anual.',
    }
  }
  if (estado.vencido) {
    return {
      ok: false,
      error: `La fecha límite (${estado.vencimiento}) ya pasó. No se puede activar pago anual.`,
    }
  }
  if (estado.activo) {
    return { ok: true, estado }
  }

  const vencimiento = vencimientoPagoAnual(cicloValor)
  const ahora = new Date().toISOString()
  const fila = {
    alumno_id: alumno.alumno_id,
    ciclo_valor: cicloValor,
    plan_meses: estado.planMeses,
    monto: estado.montoConDescuento,
    activo: true,
    pagado: false,
    vencimiento,
    activado_en: ahora,
    pagado_en: null,
    desactivado_en: null,
    desactivado_motivo: null,
    actualizado_en: ahora,
  }

  const { error } = await db.from('alumno_pago_anual').upsert(fila, {
    onConflict: 'alumno_id,ciclo_valor',
  })
  if (error) {
    return { ok: false, error: error.message || 'No se pudo activar el pago anual.' }
  }

  return { ok: true, estado: await consultarEstadoPagoAnual(db, alumno, cicloValor) }
}

export async function desactivarPagoAnual(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  motivo = 'Desactivado manualmente desde Servicios.'
): Promise<{ ok: true; estado: EstadoPagoAnual } | { ok: false; error: string }> {
  const reg = await obtenerRegistroPagoAnual(db, alumno.alumno_id, cicloValor)
  if (!reg) return { ok: false, error: 'No hay pago anual activo para este alumno.' }
  if (reg.pagado) {
    return { ok: false, error: 'El pago anual ya fue cobrado; no se puede desactivar.' }
  }

  const ahora = new Date().toISOString()
  const { error } = await db
    .from('alumno_pago_anual')
    .update({
      activo: false,
      desactivado_en: ahora,
      desactivado_motivo: motivo,
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', cicloValor)

  if (error) return { ok: false, error: error.message }

  return { ok: true, estado: await consultarEstadoPagoAnual(db, alumno, cicloValor) }
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

/**
 * Tras cobrar concepto 30: marca todas las colegiaturas del plan como pagadas en $0.
 * El importe real queda en el pago del concepto 30 (factura = Pago Anual).
 */
export async function aplicarCoberturaTrasPagoAnual(
  db: AppDatabaseClient,
  alumno: Pick<AlumnoRegistro, 'alumno_id' | 'alumno_ref' | 'mes'>,
  cicloValor: number,
  opts?: { fechaPago?: string; importePagado?: number }
): Promise<{ ok: true; insertados: string[] } | { ok: false; error: string }> {
  const reg = await obtenerRegistroPagoAnual(db, alumno.alumno_id, cicloValor)
  if (!reg?.activo) {
    return { ok: false, error: 'No hay pago anual activo para aplicar cobertura.' }
  }

  const planMeses = planMesesNormalizado(reg.plan_meses)
  const conceptos = conceptosColegiaturaPagoAnual(planMeses)
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const fechaPago = opts?.fechaPago ?? hoyIsoFecha()
  const ahora = new Date().toISOString()
  const hora = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const insertados: string[] = []
  let pagoId = await siguientePagoId(db)

  for (const concepto of conceptos) {
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
      console.error('aplicarCoberturaTrasPagoAnual:', concepto, error.message)
      pagoId = await siguientePagoId(db)
      const retry = await db.from('pago_detalle').insert({ ...fila, pago_id: pagoId })
      if (retry.error) continue
    }
    insertados.push(concepto)
    pagoId += 1
  }

  const { error: updErr } = await db
    .from('alumno_pago_anual')
    .update({
      pagado: true,
      pagado_en: ahora,
      activo: true,
      monto: opts?.importePagado != null ? opts.importePagado : reg.monto,
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', cicloValor)

  if (updErr) {
    return { ok: false, error: updErr.message }
  }

  return { ok: true, insertados }
}

/** True si el alumno debe ver concepto 30 en lugar del cascade mensual. */
export async function alumnoTienePagoAnualPendiente(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<boolean> {
  const reg = await asegurarVigenciaPagoAnual(db, alumnoId, cicloValor)
  return Boolean(reg?.activo && !reg.pagado)
}

export function etiquetaPagoAnual(): string {
  const canon = getPaymentConcept(CONCEPTO_PAGO_ANUAL)
  return canon !== '-None-' ? canon : 'Pago Anual'
}

/** Monto base del concepto 30 (para baucher / matriz). */
export function montoListaPagoAnualDesdePrecio(
  precio: Parameters<typeof montoBaseConcepto>[1],
  planMeses: PlanMeses,
  conceptos: string[]
): number {
  let total = 0
  for (const c of conceptos) {
    total += montoBaseConcepto(c, precio, planMeses).montoNormal
  }
  return Math.round(total * (1 - DESCUENTO_PAGO_ANUAL) * 100) / 100
}
