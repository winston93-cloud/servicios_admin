import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'
import {
  calcularBoucher,
  calcularImporteConcepto,
  obtenerPrecioFila,
  obtenerPorcentajeBeca,
} from './boucherService'
import { getDigVerif, getPaymentConcept, referenciaSemibase, nivelPrecioBoucher } from './boucherCore'
import { calcularRecargoPesos } from './colegiaturaPrecioReglas'
import {
  conceptoFacturaCambridge,
  rutasFacturaDesdeReferencia,
} from './portalFacturaRutas'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
  compararConceptoNoAsc,
  formatearAlumnoRefParaReferencia,
} from './pagoReferenciaColegiatura'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import {
  filtrarFilasPorCandado,
  slotsColegiaturaPortal,
  slotsLineales,
} from './portalPagosCandados'
import { obtenerAperturaConceptosPortal } from './portalAperturaConceptosService'
import { mapCorreccionesManualesVigentes } from './portalAdmisionesProrroga'
import {
  resolverPlanMesesCierre,
  resolverPlanMesesParaCiclo,
} from './portalPlanMesesCiclo'
import { debeMostrarAdeudoDobleTitulacionCiclo } from './portalDobleTitulacionAdeudo'

export interface FilaMatrizPortal {
  conceptoNo: string
  conceptoClase: string
  pagado: boolean
  /** Monto ventanilla / baucher (sin recargo de atraso). */
  importe: number | null
  /** Monto pago en línea = importe + recargo. Si null, usar importe. */
  importeLinea?: number | null
  recargo?: number
  referencia: string | null
  /** Referencia Banorte calculada con importeLinea (si hay recargo). */
  referenciaLinea?: string | null
  facturaPdf: string | null
  facturaXml: string | null
}

export interface SeccionMatrizPortal {
  id: string
  titulo: string
  planEtiqueta?: string
  filas: FilaMatrizPortal[]
}

export interface MatrizPortalPagos {
  ciclo: CicloEscolarRegistro
  alumno: AlumnoRegistro
  planMeses: number
  planEtiqueta: string
  secciones: SeccionMatrizPortal[]
}

const SECCION_COLEGIATURA = {
  id: 'colegiatura',
  titulo: 'Colegiaturas del ciclo escolar',
} as const

const SECCION_CAMBRIDGE = {
  id: 'cambridge',
  titulo: 'Cambridge',
  conceptos: ['19', '20', '22'],
} as const

/** En UI: Doble titulación (conceptos 23/24/25). */
const SECCION_USA = {
  id: 'winston-usa',
  titulo: 'Winston USA Program',
  conceptos: ['23', '24', '25'],
} as const

/** Solo en su tabla aparte (también pasan en concepto_tipo=2 en BD). */
const CONCEPTOS_SECCION_PROPIA = new Set([
  ...SECCION_CAMBRIDGE.conceptos,
  ...SECCION_USA.conceptos,
])

/** Material y Seguro (17) no se lista en el portal alumno. */
const CONCEPTOS_EXCLUIDOS_COLEGIATURA = new Set(['17', ...CONCEPTOS_SECCION_PROPIA])

/** Orden al construir filas (16 va junto a enero en pantalla vía slots). */
const ORDEN_COLEGIATURA_PORTAL = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '16',
  '06',
  '07',
  '08',
  '09',
  '10',
  '26',
] as const

export function etiquetaPlanPagos(planMeses: number): string {
  return planMeses === 2 ? 'Plan de pagos: 11 meses' : 'Plan de pagos: 10 meses'
}

/** Hay pago registrado o un importe real configurado (no sección fantasma a $0). */
function seccionTieneCobroReal(filas: FilaMatrizPortal[]): boolean {
  return filas.some(
    (f) =>
      f.pagado ||
      (Number(f.importe) || 0) > 0 ||
      (Number(f.importeLinea) || 0) > 0
  )
}

function etiquetaConceptoPortal(conceptoNo: string, conceptoClase: string): string {
  const c = normalizarConceptoNo(conceptoNo)
  // Concepto 00 en BD a veces sigue como "Cuota de Mantenimiento".
  if (c === '00') return getPaymentConcept('00')
  const canon = getPaymentConcept(c)
  return canon !== '-None-' ? canon : conceptoClase
}

function ordenColegiaturaPortal(conceptoNo: string): number {
  const c = normalizarConceptoNo(conceptoNo)
  const i = ORDEN_COLEGIATURA_PORTAL.indexOf(c as (typeof ORDEN_COLEGIATURA_PORTAL)[number])
  return i === -1 ? 999 : i
}

function pagoVigente(p: PagoDetalleRegistro): boolean {
  return p.pago_cancelado !== 1 && p.pago_cancelado !== 2
}

function buscarPagoConcepto(
  pagos: PagoDetalleRegistro[],
  conceptoNo: string,
  cicloValor: number
): PagoDetalleRegistro | null {
  const c = normalizarConceptoNo(conceptoNo)
  for (const p of pagos) {
    if (!pagoVigente(p)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.conceptoNo === c && parsed.cicloEscolar === cicloValor) return p
  }
  return null
}

async function listarConceptosColegiatura(
  supabase: AppDatabaseClient,
  planMeses: number
): Promise<{ concepto_no: string; concepto_clase: string }[]> {
  let query = supabase
    .from('concepto_boucher')
    .select('concepto_no, concepto_clase, concepto_id')
    .eq('concepto_tipo', 2)
    .neq('concepto_id', 18)
    .order('concepto_id')

  if (planMeses !== 2) {
    query = query.neq('concepto_no', '26')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((r) => ({
      concepto_no: normalizarConceptoNo(r.concepto_no),
      concepto_clase: String(r.concepto_clase).trim(),
    }))
    .filter((r) => !CONCEPTOS_EXCLUIDOS_COLEGIATURA.has(r.concepto_no))
    .sort((a, b) => ordenColegiaturaPortal(a.concepto_no) - ordenColegiaturaPortal(b.concepto_no))
}

async function listarConceptosPorNumeros(
  supabase: AppDatabaseClient,
  numeros: string[]
): Promise<{ concepto_no: string; concepto_clase: string }[]> {
  if (numeros.length === 0) return []
  const { data, error } = await supabase
    .from('concepto_boucher')
    .select('concepto_no, concepto_clase')
    .in('concepto_no', numeros)
    .order('concepto_id')

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((r) => ({
      concepto_no: normalizarConceptoNo(r.concepto_no),
      concepto_clase: String(r.concepto_clase).trim(),
    }))
    .sort((a, b) => compararConceptoNoAsc(a.concepto_no, b.concepto_no))
}

async function construirFilas(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  conceptos: { concepto_no: string; concepto_clase: string }[],
  pagos: PagoDetalleRegistro[],
  planMeses: number,
  usarCodigoCambridge = false
): Promise<FilaMatrizPortal[]> {
  const nivelPrecio = nivelPrecioBoucher(
    alumno.alumno_nivel,
    Number(alumno.alumno_grado) || 0
  )

  const precio = await obtenerPrecioFila(supabase, nivelPrecio, ciclo.valor)
  if (!precio) {
    throw new Error(
      `No hay precios configurados para tu nivel en el ciclo ${ciclo.nombre}.`
    )
  }

  const becaPct = await obtenerPorcentajeBeca(supabase, alumno.alumno_id, ciclo.valor)
  const correcciones = await mapCorreccionesManualesVigentes(
    supabase,
    Number(alumno.alumno_ref),
    ciclo.valor
  )
  const control = formatearAlumnoRefParaReferencia(alumno.alumno_ref)
  const filas: FilaMatrizPortal[] = []

  for (const row of conceptos) {
    const conceptoNo = row.concepto_no
    const pago = buscarPagoConcepto(pagos, conceptoNo, ciclo.valor)
    const codigoFactura = usarCodigoCambridge
      ? conceptoFacturaCambridge(
          row.concepto_clase,
          parsearReferenciaPago(pago?.pago_referencia ?? '')?.conceptoNo
        )
      : conceptoNo

    const facturas = rutasFacturaDesdeReferencia(
      pago?.pago_referencia,
      control,
      codigoFactura,
      ciclo.valor
    )

    if (pago) {
      filas.push({
        conceptoNo,
        conceptoClase: etiquetaConceptoPortal(conceptoNo, row.concepto_clase),
        pagado: true,
        importe: pago.pago_importe + pago.pago_recargo,
        importeLinea: pago.pago_importe + pago.pago_recargo,
        recargo: Number(pago.pago_recargo) || 0,
        referencia: pago.pago_referencia,
        referenciaLinea: pago.pago_referencia,
        facturaPdf: facturas.pdf,
        facturaXml: facturas.xml,
      })
      continue
    }

    const correccion = correcciones.get(conceptoNo)
    const importe =
      correccion != null
        ? correccion.monto
        : calcularImporteConcepto(conceptoNo, precio, becaPct, planMeses, {
            alumnoRef: alumno.alumno_ref,
            cicloEscolar: ciclo.valor,
          })
    // Importe de corrección es el monto pactado; no sumar recargo de atraso.
    const recargo =
      correccion != null ? 0 : calcularRecargoPesos(conceptoNo, new Date(), ciclo.valor)
    const importeLinea = Math.round((importe + recargo) * 100) / 100
    const semibase = referenciaSemibase(alumno.alumno_ref, conceptoNo, ciclo.valor)
    const referencia = getDigVerif(importe, semibase)
    const referenciaLinea =
      recargo > 0 ? getDigVerif(importeLinea, semibase) : referencia

    filas.push({
      conceptoNo,
      conceptoClase: etiquetaConceptoPortal(conceptoNo, row.concepto_clase),
      pagado: false,
      importe,
      importeLinea,
      recargo,
      referencia,
      referenciaLinea,
      facturaPdf: null,
      facturaXml: null,
    })
  }

  return filas
}

/** Conceptos de inscripción / reinscripción (no aparecen en candados de colegiatura). */
export const CONCEPTOS_INSCRIPCION_REINSCRITO = ['11', '12', '13'] as const
export const CONCEPTO_INSCRIPCION_NUEVO = '13'

export async function construirFilasInscripcionPortal(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  pagos: PagoDetalleRegistro[],
  esReinscrito: boolean
): Promise<FilaMatrizPortal[]> {
  const numeros = esReinscrito
    ? [...CONCEPTOS_INSCRIPCION_REINSCRITO]
    : [CONCEPTO_INSCRIPCION_NUEVO]
  const conceptos = await listarConceptosPorNumeros(supabase, numeros)
  const planMeses = alumno.mes === 2 ? 2 : 1
  const filas = await construirFilas(supabase, alumno, ciclo, conceptos, pagos, planMeses)

  const orden = esReinscrito ? [...CONCEPTOS_INSCRIPCION_REINSCRITO] : [CONCEPTO_INSCRIPCION_NUEVO]
  const porConcepto = new Map(filas.map((f) => [normalizarConceptoNo(f.conceptoNo), f]))
  const pagadas = orden
    .map((c) => porConcepto.get(normalizarConceptoNo(c)))
    .filter((f): f is FilaMatrizPortal => f != null && f.pagado)
  const primeraPendiente = orden
    .map((c) => porConcepto.get(normalizarConceptoNo(c)))
    .find((f): f is FilaMatrizPortal => f != null && !f.pagado)

  if (primeraPendiente) return [...pagadas, primeraPendiente]
  return pagadas
}

export async function construirMatrizPortalPagos(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  pagos: PagoDetalleRegistro[],
  opciones?: { soloColegiatura?: boolean; soloDobleAdeudoPrevio?: boolean }
): Promise<MatrizPortalPagos> {
  const soloColegiatura = Boolean(opciones?.soloColegiatura)
  const soloDobleAdeudoPrevio = Boolean(opciones?.soloDobleAdeudoPrevio)

  // Adeudo opcional de doble titulación de un ciclo anterior (no bloquea inscripción).
  if (soloDobleAdeudoPrevio) {
    const planMeses = await resolverPlanMesesParaCiclo(supabase, alumno, ciclo.valor, pagos)
    const conceptosUsa = await listarConceptosPorNumeros(supabase, [...SECCION_USA.conceptos])
    const filasUsaRaw =
      conceptosUsa.length > 0
        ? await construirFilas(supabase, alumno, ciclo, conceptosUsa, pagos, planMeses)
        : []
    const filasUsa = filtrarFilasPorCandado(filasUsaRaw, slotsLineales(SECCION_USA.conceptos))

    return {
      ciclo,
      alumno,
      planMeses,
      planEtiqueta: etiquetaPlanPagos(planMeses),
      secciones:
        seccionTieneCobroReal(filasUsa) || filasUsa.some((f) => f.pagado)
          ? [
              {
                id: 'doble-adeudo-previo',
                titulo: `Doble titulación · ciclo ${ciclo.nombre}`,
                filas: filasUsa,
              },
            ]
          : [],
    }
  }

  // Cierre: plan del ciclo a liquidar (no el elegido para el ciclo nuevo).
  // Colegiaturas del ciclo en curso/destino: plan de ese ciclo.
  const planMeses = soloColegiatura
    ? await resolverPlanMesesCierre(supabase, alumno, ciclo.valor, pagos)
    : await resolverPlanMesesParaCiclo(supabase, alumno, ciclo.valor, pagos)

  const planEtiqueta = etiquetaPlanPagos(planMeses)

  const conceptosColeg = await listarConceptosColegiatura(supabase, planMeses)
  const filasColegRaw = await construirFilas(
    supabase,
    alumno,
    ciclo,
    conceptosColeg,
    pagos,
    planMeses
  )
  const filasColeg = filtrarFilasPorCandado(
    filasColegRaw,
    slotsColegiaturaPortal(planMeses)
  )

  const secciones: SeccionMatrizPortal[] = [
    {
      id: SECCION_COLEGIATURA.id,
      titulo: soloColegiatura
        ? `Cierre de ciclo ${ciclo.nombre}`
        : SECCION_COLEGIATURA.titulo,
      filas: filasColeg,
    },
  ]

  if (!soloColegiatura) {
    const apertura = await obtenerAperturaConceptosPortal(supabase)

    if (apertura.cambridge_abierto || apertura.doble_titulacion_abierto) {
      const [conceptosCam, conceptosUsa] = await Promise.all([
        apertura.cambridge_abierto
          ? listarConceptosPorNumeros(supabase, [...SECCION_CAMBRIDGE.conceptos])
          : Promise.resolve([]),
        apertura.doble_titulacion_abierto
          ? listarConceptosPorNumeros(supabase, [...SECCION_USA.conceptos])
          : Promise.resolve([]),
      ])

      const [filasCamRaw, filasUsaRaw] = await Promise.all([
        conceptosCam.length > 0
          ? construirFilas(supabase, alumno, ciclo, conceptosCam, pagos, planMeses, true)
          : Promise.resolve([]),
        conceptosUsa.length > 0
          ? construirFilas(supabase, alumno, ciclo, conceptosUsa, pagos, planMeses)
          : Promise.resolve([]),
      ])

      const filasCam = filtrarFilasPorCandado(
        filasCamRaw,
        slotsLineales(SECCION_CAMBRIDGE.conceptos)
      )
      const filasUsa = filtrarFilasPorCandado(
        filasUsaRaw,
        slotsLineales(SECCION_USA.conceptos)
      )

      // No mostrar Cambridge/USA si el ciclo aún no tiene precio (antes inventaba $975)
      // ni renglones a $0 sin pago registrado.
      if (apertura.cambridge_abierto && seccionTieneCobroReal(filasCam)) {
        secciones.push({
          id: SECCION_CAMBRIDGE.id,
          titulo: SECCION_CAMBRIDGE.titulo,
          filas: filasCam,
        })
      }

      if (apertura.doble_titulacion_abierto && seccionTieneCobroReal(filasUsa)) {
        secciones.push({
          id: SECCION_USA.id,
          titulo: SECCION_USA.titulo,
          filas: filasUsa,
        })
      }
    }
  }

  return {
    ciclo,
    alumno,
    planMeses,
    planEtiqueta,
    secciones,
  }
}

/** ¿Hay tercios 23/24/25 pendientes de un ciclo en el que ya empezó el programa? */
export function alumnoTieneDobleAdeudoPrevio(
  pagos: PagoDetalleRegistro[],
  alumno: Pick<AlumnoRegistro, 'alumno_ref'>,
  cicloValor: number
): boolean {
  return debeMostrarAdeudoDobleTitulacionCiclo(pagos, alumno.alumno_ref, cicloValor)
}

/** Recalcula referencia con dígito verificador (misma lógica que bauchers). */
export async function recalcularReferenciaPortal(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  conceptoNo: string,
  cicloValor: number,
  importe?: number
): Promise<{ importe: number; importeLinea: number; recargo: number; referencia: string; referenciaLinea: string }> {
  return calcularBoucher(supabase, {
    alumnoId: alumno.alumno_id,
    alumnoRef: alumno.alumno_ref,
    alumnoNivel: alumno.alumno_nivel,
    alumnoGrado: Number(alumno.alumno_grado) || 0,
    conceptoNo,
    cicloEscolar: cicloValor,
    importeManual: importe,
    planMeses: alumno.mes === 2 ? 2 : 1,
  })
}
