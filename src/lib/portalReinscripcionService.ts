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
 *  - Destino = ciclo de la ficha + 1 mientras la ficha no haya avanzado al
 *    ciclo de inscripción de la temporada (ej. 22 → 23). Tras el cambio de
 *    ciclo administrativo (ficha ya en 23) no se vuelve a promover grado/nivel.
 *  - Concepto 11 = Diferido 1 (mitad del importe con descuento de reinscripción).
 *  - Concepto 12 = Diferido 2 (resto = importe de lista − lo pagado en Dif1).
 *  - Concepto 13 = Inscripción completa (pago en una sola exhibición).
 *  - Costos / referencias / reglamentos usan el ciclo destino y nivel/grado proyectados.
 *  - La reinscripción está CUBIERTA solo con: concepto 13, o 11 + 12.
 */

import { proyectarReinscripcionAlumno } from './portalReinscripcionProyeccion'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

interface PagoInscripcionCiclo {
  referencia: string
  concepto: string
  importe: number
}

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
    proyectaPromocion: proy.proyectaPromocion,
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
