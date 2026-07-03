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
import { normalizarConceptoNo, parsearReferenciaPago } from './pagoReferenciaColegiatura'
import type { FilaMatrizPortal } from './portalPagosMatrizService'

/**
 * Reinscripción por diferidos — port de `admisiones` (loader.php
 * `admisiones_monto_baucher_reinscrito` + prorroga_inscripcion.php).
 *
 * Reglas clave (verificadas con datos reales):
 *  - La reinscripción es para el ciclo SIGUIENTE (cen = alumno_ciclo_escolar + 1)
 *    mientras estemos antes del cambio de ciclo (20 de julio).
 *  - Concepto 11 = Diferido 1 (mitad del importe con descuento de reinscripción).
 *  - Concepto 12 = Diferido 2 (resto = importe de lista − lo pagado en Dif1, sin descuento).
 *  - Concepto 13 = Inscripción completa (pago en una sola exhibición).
 *  - El descuento aplica sobre el precio de inscripción del cen:
 *      cambio de nivel  → descuento_cambio_nivel
 *      promoción normal → descuento_cambio_grado
 *  - La reinscripción está CUBIERTA solo con: concepto 13, o 11 + 12.
 */

const CAMBIO_CICLO = '07-20'

function mmddHoy(): string {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

interface PagoInscripcionCiclo {
  referencia: string
  concepto: string
  importe: number
}

export interface ReinscripcionDiferido {
  /** Ciclo escolar al que se reinscribe (alumno_ciclo_escolar + 1 antes del cambio de ciclo). */
  cicloReinscripcion: number
  nivelDestino: number
  gradoDestino: number
  cambioNivel: boolean
  graduado: boolean
  /** Reinscripción cubierta (13, o 11 + 12). */
  completa: boolean
  /** Hay un diferido pendiente por cobrar. */
  pagable: boolean
  /** Diferido vigente: 1 = concepto 11, 2 = concepto 12, null si completa/graduado. */
  diferido: 1 | 2 | null
  concepto: string
  conceptoClase: string
  monto: number
  referencia: string
  dif1Pagado: boolean
  dif1Importe: number
  filasPagadas: FilaMatrizPortal[]
  filaPendiente: FilaMatrizPortal | null
}

/**
 * Proyecta nivel/grado/ciclo al ciclo de reinscripción (misma promoción que el viejito).
 */
function proyectarReinscripcion(alumno: AlumnoRegistro): {
  cen: number
  nivel: number
  grado: number
  cambioNivel: boolean
  graduado: boolean
} {
  let nivel = Number(alumno.alumno_nivel) || 0
  let grado = Number(alumno.alumno_grado) || 0
  let cen = Number(alumno.alumno_ciclo_escolar) || 0
  let cambioNivel = false
  let graduado = false

  if (mmddHoy() < CAMBIO_CICLO) {
    cen++
    if (nivel === 1 && grado === 2) {
      nivel = 2
      grado = 1
      cambioNivel = true
    } else if (nivel === 2 && grado === 3) {
      nivel = 3
      grado = 1
      cambioNivel = true
    } else if (nivel === 3 && grado === 6) {
      nivel = 4
      grado = 1
      cambioNivel = true
    } else if (nivel === 4 && grado === 3) {
      graduado = true
    } else {
      grado++
    }
  } else if (nivel === 4 && grado === 3) {
    graduado = true
  }

  return { cen, nivel, grado, cambioNivel, graduado }
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

  const { cen, nivel, grado, cambioNivel, graduado } = proyectarReinscripcion(alumno)
  const pagos = await pagosInscripcionCiclo(supabase, alumno.alumno_id, cen)

  const pago11 = pagos.find((p) => p.concepto === '11') ?? null
  const pago12 = pagos.find((p) => p.concepto === '12') ?? null
  const pago13 = pagos.find((p) => p.concepto === '13') ?? null
  const dif1Pagado = pago11 != null
  const dif1Importe = pago11?.importe ?? 0
  const completa = pago13 != null || (pago11 != null && pago12 != null)

  const filasPagadas: FilaMatrizPortal[] = []
  for (const c of ['11', '12', '13'] as const) {
    const p = pagos.find((x) => x.concepto === c)
    if (p) {
      filasPagadas.push({
        conceptoNo: c,
        conceptoClase: getPaymentConcept(c),
        pagado: true,
        importe: p.importe,
        referencia: p.referencia,
        facturaPdf: null,
        facturaXml: null,
      })
    }
  }

  const base: ReinscripcionDiferido = {
    cicloReinscripcion: cen,
    nivelDestino: nivel,
    gradoDestino: grado,
    cambioNivel,
    graduado,
    completa,
    pagable: false,
    diferido: null,
    concepto: pago13 ? '13' : pago12 ? '12' : '11',
    conceptoClase: '',
    monto: 0,
    referencia: '',
    dif1Pagado,
    dif1Importe,
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
    // Sin precio configurado para el ciclo/nivel: no se puede cobrar todavía.
    base.concepto = dif1Pagado ? '12' : '11'
    base.conceptoClase = getPaymentConcept(base.concepto)
    base.diferido = dif1Pagado ? 2 : 1
    return base
  }

  const percent = cambioNivel ? precio.descuento_cambio_nivel : precio.descuento_cambio_grado
  const montoIns = precio.precio_inscripcion

  let concepto: string
  let monto: number
  let diferido: 1 | 2
  if (dif1Pagado) {
    // Diferido 2: resto sin descuento (importe de lista − lo pagado en Dif1).
    concepto = '12'
    diferido = 2
    monto = Math.max(0, round2(montoIns - dif1Importe))
  } else {
    // Diferido 1: mitad del importe con descuento de reinscripción.
    concepto = '11'
    diferido = 1
    monto = Math.round(getDiscount(montoIns, percent) / 2)
  }

  if (monto <= 0) {
    base.completa = true
    base.concepto = concepto
    base.conceptoClase = getPaymentConcept(concepto)
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
