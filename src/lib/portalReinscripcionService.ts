import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import { obtenerPrecioFila } from './boucherService'
import {
  getDigVerif,
  getDiscount,
  getPaymentConcept,
  nivelPrecioBoucher,
  referenciaSemibase,
} from './boucherCore'
import { hoyIso } from './portalAdmisionesCiclo'
import {
  obtenerVentanasInscripcion,
  type VentanasInscripcion,
} from './portalAdmisionesVentanas'
import {
  obtenerAutorizacionPortalDif2,
  tieneAccesoProrrogaDif1,
} from './portalAdmisionesProrroga'
import { normalizarConceptoNo, parsearReferenciaPago, formatearAlumnoRefParaReferencia } from './pagoReferenciaColegiatura'
import { rutasFacturaDesdeReferencia } from './portalFacturaRutas'
import type { FilaMatrizPortal } from './portalPagosMatrizService'
import { proyectarReinscripcionAlumno } from './portalReinscripcionProyeccion'

/**
 * Reinscripción por diferidos — port de `admisiones` (loader.php
 * `admisiones_monto_baucher_reinscrito` + prorroga_inscripcion.php).
 *
 * Montos calendáricos:
 *  - Ventana Dif1 (o prórroga 11): concepto 11 = mitad con descuento.
 *  - Ventana Dif2 / post-Dif2 hasta 31-dic: con Dif1 → 12 resto; sin Dif1 → 13 lista.
 *  - Hueco Dif1→Dif2: no pagable (salvo auth Dif2, que cobra como Dif2).
 *  - Cubierta: 13, o 11 + 12.
 */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

interface PagoInscripcionCiclo {
  referencia: string
  concepto: string
  importe: number
}

export type FaseCobroReinscripcion =
  | 'pre-dif1'
  | 'dif1'
  | 'hueco'
  | 'dif2'
  | 'post-dif2'
  | 'cerrado-anual'
  | 'sin-fechas'

export interface ReinscripcionDiferido {
  /** Ciclo escolar al que se reinscribe (costos, reglamentos, referencias). */
  cicloReinscripcion: number
  nivelDestino: number
  gradoDestino: number
  /** true si la ficha aún no avanzó y se proyectó grado/nivel al destino. */
  proyectaPromocion: boolean
  cambioNivel: boolean
  graduado: boolean
  /** Reinscripción cubierta (13, o 11 + 12). */
  completa: boolean
  /** Hay un concepto pendiente por cobrar en la fase actual. */
  pagable: boolean
  /** Diferido vigente: 1 = 11, 2 = 12, null si completa / 13 / fuera de cobro. */
  diferido: 1 | 2 | null
  concepto: string
  conceptoClase: string
  monto: number
  referencia: string
  dif1Pagado: boolean
  dif1Importe: number
  fase: FaseCobroReinscripcion
  ventanas: VentanasInscripcion
  filasPagadas: FilaMatrizPortal[]
  filaPendiente: FilaMatrizPortal | null
}

/** Corte inclusivo: portal post-Dif2 abierto hasta el 31-dic del año de fin Dif2. */
export function corteDiciembrePostDif2(fechaFinDif2: string): string {
  return `${fechaFinDif2.slice(0, 4)}-12-31`
}

export function resolverFaseCobroReinscripcion(
  cd: string,
  ventanas: VentanasInscripcion,
  opts: { prorrogaDif1: boolean; authDif2: boolean }
): FaseCobroReinscripcion {
  const { fechaIniDif1, fechaFinDif1, fechaIniDif2, fechaFinDif2 } = ventanas
  if (!fechaIniDif1 || !fechaFinDif1 || !fechaIniDif2 || !fechaFinDif2) {
    return 'sin-fechas'
  }

  const corteDic = corteDiciembrePostDif2(fechaFinDif2)
  if (cd > corteDic) return 'cerrado-anual'
  if (cd > fechaFinDif2) return 'post-dif2'
  if (cd >= fechaIniDif2 && cd <= fechaFinDif2) return 'dif2'

  // Hueco Dif1 → Dif2
  if (cd > fechaFinDif1 && cd < fechaIniDif2) {
    if (opts.authDif2) return 'dif2'
    if (opts.prorrogaDif1) return 'dif1'
    return 'hueco'
  }

  if (
    (cd >= fechaIniDif1 && cd <= fechaFinDif1) ||
    (opts.prorrogaDif1 && cd < fechaIniDif2)
  ) {
    return 'dif1'
  }

  if (cd < fechaIniDif1) return 'pre-dif1'
  return 'sin-fechas'
}

async function pagosInscripcionCiclo(
  supabase: AppDatabaseClient,
  alumnoId: number,
  cen: number
): Promise<PagoInscripcionCiclo[]> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select('pago_referencia, pago_importe, pago_recargo, pago_cancelado')
    .eq('alumno_id', alumnoId)
    .limit(500)

  if (error || !data) return []

  const out: PagoInscripcionCiclo[] = []
  for (const p of data as Array<Record<string, unknown>>) {
    const cancelado = Number(p.pago_cancelado)
    if (cancelado === 1 || cancelado === 2) continue
    const parsed = parsearReferenciaPago(String(p.pago_referencia ?? ''))
    if (!parsed) continue
    const concepto = normalizarConceptoNo(parsed.conceptoNo)
    if (concepto !== '11' && concepto !== '12' && concepto !== '13') continue
    if (parsed.cicloEscolar !== cen) continue
    out.push({
      referencia: String(p.pago_referencia),
      concepto,
      importe: Number(p.pago_importe ?? 0) + Number(p.pago_recargo ?? 0),
    })
  }
  return out
}

/**
 * Calcula el estado de reinscripción por diferidos para un alumno reinscrito.
 * Devuelve `null` para nuevo ingreso (usa el flujo de concepto 13 existente).
 */
export async function calcularReinscripcionDiferido(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro
): Promise<ReinscripcionDiferido | null> {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) !== 0) return null

  const proy = proyectarReinscripcionAlumno(alumno)
  const cen = proy.cicloDestino
  const nivel = proy.nivel
  const grado = proy.grado
  const { cambioNivel, graduado } = proy
  const pagos = await pagosInscripcionCiclo(supabase, alumno.alumno_id, cen)

  const pago11 = pagos.find((p) => p.concepto === '11') ?? null
  const pago12 = pagos.find((p) => p.concepto === '12') ?? null
  const pago13 = pagos.find((p) => p.concepto === '13') ?? null
  const dif1Pagado = pago11 != null
  const dif1Importe = pago11?.importe ?? 0
  const completa = pago13 != null || (pago11 != null && pago12 != null)

  const alumnoMes = Number(alumno.mes ?? 0)
  const ventanas = await obtenerVentanasInscripcion(supabase, cen, alumnoMes)
  const cd = hoyIso()
  const prorrogaDif1 = await tieneAccesoProrrogaDif1(supabase, Number(alumno.alumno_ref), cen)
  const authDif2 = await obtenerAutorizacionPortalDif2(supabase, Number(alumno.alumno_ref), cen)
  const fase = resolverFaseCobroReinscripcion(cd, ventanas, {
    prorrogaDif1,
    authDif2: authDif2.activa,
  })

  const filasPagadas: FilaMatrizPortal[] = []
  for (const c of ['11', '12', '13'] as const) {
    const p = pagos.find((x) => x.concepto === c)
    if (p) {
      const facturas = rutasFacturaDesdeReferencia(
        p.referencia,
        formatearAlumnoRefParaReferencia(alumno.alumno_ref),
        c,
        cen
      )
      filasPagadas.push({
        conceptoNo: c,
        conceptoClase: getPaymentConcept(c),
        pagado: true,
        importe: p.importe,
        referencia: p.referencia,
        facturaPdf: facturas.pdf,
        facturaXml: facturas.xml,
      })
    }
  }

  const base: ReinscripcionDiferido = {
    cicloReinscripcion: cen,
    nivelDestino: nivel,
    gradoDestino: grado,
    proyectaPromocion: proy.proyectaPromocion,
    cambioNivel,
    graduado,
    completa,
    pagable: false,
    diferido: null,
    concepto: pago13 ? '13' : pago12 ? '12' : dif1Pagado ? '11' : '13',
    conceptoClase: '',
    monto: 0,
    referencia: '',
    dif1Pagado,
    dif1Importe,
    fase,
    ventanas,
    filasPagadas,
    filaPendiente: null,
  }

  if (graduado || completa) {
    base.conceptoClase = getPaymentConcept(base.concepto)
    return base
  }

  const nivelPrecio = nivelPrecioBoucher(nivel, grado)
  const precio = await obtenerPrecioFila(supabase, nivelPrecio, cen)
  if (!precio) {
    base.conceptoClase = getPaymentConcept(base.concepto)
    return base
  }

  const percent = cambioNivel ? precio.descuento_cambio_nivel : precio.descuento_cambio_grado
  const montoIns = precio.precio_inscripcion

  let concepto: string | null = null
  let monto = 0
  let diferido: 1 | 2 | null = null

  if (fase === 'dif1') {
    if (!dif1Pagado) {
      concepto = '11'
      diferido = 1
      monto = Math.round(getDiscount(montoIns, percent) / 2)
    }
  } else if (fase === 'dif2' || fase === 'post-dif2') {
    if (dif1Pagado) {
      concepto = '12'
      diferido = 2
      monto = Math.max(0, round2(montoIns - dif1Importe))
    } else {
      concepto = '13'
      diferido = null
      monto = round2(montoIns)
    }
  }
  // pre-dif1 | hueco | cerrado-anual | sin-fechas → no pagable

  if (!concepto || monto <= 0) {
    if (concepto && monto <= 0) {
      base.completa = true
      base.concepto = concepto
      base.conceptoClase = getPaymentConcept(concepto)
      base.diferido = diferido
    } else {
      base.conceptoClase = getPaymentConcept(base.concepto)
    }
    return base
  }

  const conceptoClase = getPaymentConcept(concepto)
  const referencia = getDigVerif(monto, referenciaSemibase(alumno.alumno_ref, concepto, cen))

  base.concepto = concepto
  base.conceptoClase = conceptoClase
  base.monto = monto
  base.referencia = referencia
  base.pagable = true
  base.diferido = diferido
  base.filaPendiente = {
    conceptoNo: concepto,
    conceptoClase,
    pagado: false,
    importe: monto,
    referencia,
    facturaPdf: null,
    facturaXml: null,
  }
  return base
}
