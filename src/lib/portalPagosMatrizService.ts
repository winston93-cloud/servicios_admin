import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'
import {
  calcularBoucher,
  calcularImporteConcepto,
  obtenerPrecioFila,
  obtenerPorcentajeBeca,
} from './boucherService'
import { getDigVerif, referenciaSemibase } from './boucherCore'
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

export interface FilaMatrizPortal {
  conceptoNo: string
  conceptoClase: string
  pagado: boolean
  importe: number | null
  referencia: string | null
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

const SECCION_USA = {
  id: 'winston-usa',
  titulo: 'Winston USA Program',
  conceptos: ['23', '24', '25'],
} as const

/** Solo en su tabla aparte (también están en concepto_tipo=2 en BD). */
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
  const nivelPrecio =
    alumno.alumno_nivel === 2 && Number(alumno.alumno_grado) === 1
      ? 1
      : alumno.alumno_nivel

  const precio = await obtenerPrecioFila(supabase, nivelPrecio, ciclo.valor)
  if (!precio) {
    throw new Error(
      `No hay precios configurados para tu nivel en el ciclo ${ciclo.nombre}.`
    )
  }

  const becaPct = await obtenerPorcentajeBeca(supabase, alumno.alumno_id, ciclo.valor)
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
        conceptoClase: row.concepto_clase,
        pagado: true,
        importe: pago.pago_importe + pago.pago_recargo,
        referencia: pago.pago_referencia,
        facturaPdf: facturas.pdf,
        facturaXml: facturas.xml,
      })
      continue
    }

    const importe = calcularImporteConcepto(conceptoNo, precio, becaPct, planMeses)
    const semibase = referenciaSemibase(alumno.alumno_ref, conceptoNo, ciclo.valor)
    const referencia = getDigVerif(importe, semibase)

    filas.push({
      conceptoNo,
      conceptoClase: row.concepto_clase,
      pagado: false,
      importe,
      referencia,
      facturaPdf: facturas.pdf,
      facturaXml: facturas.xml,
    })
  }

  return filas
}

export async function construirMatrizPortalPagos(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  pagos: PagoDetalleRegistro[]
): Promise<MatrizPortalPagos> {
  const planMeses = alumno.mes === 2 ? 2 : 1
  const planEtiqueta = etiquetaPlanPagos(planMeses)

  const [conceptosColeg, conceptosCam, conceptosUsa] = await Promise.all([
    listarConceptosColegiatura(supabase, planMeses),
    listarConceptosPorNumeros(supabase, [...SECCION_CAMBRIDGE.conceptos]),
    listarConceptosPorNumeros(supabase, [...SECCION_USA.conceptos]),
  ])

  const [filasColegRaw, filasCamRaw, filasUsaRaw] = await Promise.all([
    construirFilas(supabase, alumno, ciclo, conceptosColeg, pagos, planMeses),
    conceptosCam.length > 0
      ? construirFilas(supabase, alumno, ciclo, conceptosCam, pagos, planMeses, true)
      : Promise.resolve([]),
    conceptosUsa.length > 0
      ? construirFilas(supabase, alumno, ciclo, conceptosUsa, pagos, planMeses)
      : Promise.resolve([]),
  ])

  const filasColeg = filtrarFilasPorCandado(
    filasColegRaw,
    slotsColegiaturaPortal(planMeses)
  )
  const filasCam = filtrarFilasPorCandado(
    filasCamRaw,
    slotsLineales(SECCION_CAMBRIDGE.conceptos)
  )
  const filasUsa = filtrarFilasPorCandado(
    filasUsaRaw,
    slotsLineales(SECCION_USA.conceptos)
  )

  const secciones: SeccionMatrizPortal[] = [
    {
      id: SECCION_COLEGIATURA.id,
      titulo: SECCION_COLEGIATURA.titulo,
      filas: filasColeg,
    },
  ]

  if (filasCam.length > 0) {
    secciones.push({
      id: SECCION_CAMBRIDGE.id,
      titulo: SECCION_CAMBRIDGE.titulo,
      filas: filasCam,
    })
  }

  if (filasUsa.length > 0) {
    secciones.push({
      id: SECCION_USA.id,
      titulo: SECCION_USA.titulo,
      filas: filasUsa,
    })
  }

  return {
    ciclo,
    alumno,
    planMeses,
    planEtiqueta,
    secciones,
  }
}

/** Recalcula referencia con dígito verificador (misma lógica que bauchers). */
export async function recalcularReferenciaPortal(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  conceptoNo: string,
  cicloValor: number,
  importe?: number
): Promise<{ importe: number; referencia: string }> {
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
