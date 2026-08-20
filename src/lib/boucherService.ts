import type { AppDatabaseClient } from '@/lib/dbTypes'
import { normalizarConceptoNo, compararConceptoNoAsc } from './pagoReferenciaColegiatura'
import {
  getDigVerif,
  getDiscount,
  parseImporteBoucher,
  referenciaSemibase,
  nivelPrecioBoucher,
} from './boucherCore'
import {
  becaWinstonAplicaEnFecha,
  calcularRecargoPesos,
  conceptoAplicaSepYRecargo,
} from './colegiaturaPrecioReglas'
import { montoBecaSep } from './integracionSep'
import { sepAplicaEnCicloCobro } from './becasCobroPolitica'
import { faltanteColegiaturaPendiente } from './faltantesColegiaturaCiclo23'
import {
  aplicarCreditoRecargoAImporte,
  resolverCreditoRecargoCuotaInicio,
} from './creditoRecargoCuotaInicio'
import { obtenerCorreccionManualActiva } from './portalAdmisionesProrroga'
import {
  esAlumnoNuevoIngreso,
  importeInscripcionNuevoIngreso,
} from './inscripcionNuevoIngresoDescuento'

export interface PrecioBoucherRow {
  precio_id: number
  alumno_nivel: number
  precio_inscripcion: number
  precio_material: number
  precio_seguro: number
  precio_cuota_padres: number
  precio_agosto: number
  precio_colegiatura: number
  precio_colegiatura2: number
  precio_cambridge: number
  precio_dtitulacion: number
  descuento_cambio_nivel: number
  descuento_cambio_grado: number
  precio_ciclo_escolar: number
}

export interface ConceptoBoucherOpcion {
  concepto_no: string
  concepto_clase: string
}

export interface FilaTablaPrecios {
  nivel: number
  inscripcion: number
  agosto: number
  colegiatura: number
  material: number
  seguro: number
  cuotaPadres: number
  cambridge: number
}

export async function listarConceptosBoucherPagos(
  supabase: AppDatabaseClient
): Promise<ConceptoBoucherOpcion[]> {
  const { data, error } = await supabase
    .from('concepto_boucher')
    .select('concepto_no, concepto_clase, concepto_tipo')
    .neq('concepto_tipo', 3)
    .order('concepto_id')

  if (error) throw new Error(error.message)
  const filas = (data ?? []).map((r) => ({
    concepto_no: normalizarConceptoNo(r.concepto_no),
    concepto_clase: String(r.concepto_clase).trim(),
  }))
  return filas.sort((a, b) => compararConceptoNoAsc(a.concepto_no, b.concepto_no))
}

export async function listarPreciosPorCiclo(
  supabase: AppDatabaseClient,
  cicloEscolar: number
): Promise<FilaTablaPrecios[]> {
  const { data, error } = await supabase
    .from('pago_boucher_precio')
    .select(
      'alumno_nivel, precio_inscripcion, precio_agosto, precio_colegiatura, precio_material, precio_seguro, precio_cuota_padres, precio_cambridge'
    )
    .eq('precio_ciclo_escolar', cicloEscolar)
    .order('alumno_nivel')

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      throw new Error(
        'La tabla pago_boucher_precio no está en Supabase. Ejecuta sql/pago_boucher_precio_add.sql e importa los datos.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => ({
    nivel: Number(r.alumno_nivel),
    inscripcion: Number(r.precio_inscripcion),
    agosto: Number(r.precio_agosto),
    colegiatura: Number(r.precio_colegiatura),
    material: Number(r.precio_material),
    seguro: Number(r.precio_seguro),
    cuotaPadres: Number(r.precio_cuota_padres),
    cambridge: Number(r.precio_cambridge),
  }))
}

export async function obtenerPrecioFila(
  supabase: AppDatabaseClient,
  nivel: number,
  cicloEscolar: number
): Promise<PrecioBoucherRow | null> {
  const { data, error } = await supabase
    .from('pago_boucher_precio')
    .select('*')
    .eq('alumno_nivel', nivel)
    .eq('precio_ciclo_escolar', cicloEscolar)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    precio_id: Number(data.precio_id),
    alumno_nivel: Number(data.alumno_nivel),
    precio_inscripcion: Number(data.precio_inscripcion),
    precio_material: Number(data.precio_material),
    precio_seguro: Number(data.precio_seguro),
    precio_cuota_padres: Number(data.precio_cuota_padres),
    precio_agosto: Number(data.precio_agosto),
    precio_colegiatura: Number(data.precio_colegiatura),
    precio_colegiatura2: Number(data.precio_colegiatura2),
    precio_cambridge: Number(data.precio_cambridge),
    precio_dtitulacion: Number(data.precio_dtitulacion),
    descuento_cambio_nivel: Number(data.descuento_cambio_nivel),
    descuento_cambio_grado: Number(data.descuento_cambio_grado),
    precio_ciclo_escolar: Number(data.precio_ciclo_escolar),
  }
}

export async function obtenerPorcentajeBeca(
  supabase: AppDatabaseClient,
  alumnoId: number,
  cicloEscolar: number
): Promise<number> {
  // Winston: solo si está autorizada en alumno_beca (estatus 1) para este ciclo.
  // becas_renovacion «Autorizar beca» escribe esa fila.
  const { data } = await supabase
    .from('alumno_beca')
    .select('beca_porcentaje')
    .eq('alumno_id', alumnoId)
    .eq('beca_estatus', 1)
    .eq('beca_ciclo_escolar', cicloEscolar)
    .maybeSingle()

  return data?.beca_porcentaje != null ? Number(data.beca_porcentaje) : 0
}

/** Monto de lista (sin beca) y si el concepto admite descuento Winston. */
export function montoBaseConcepto(
  conceptoNo: string,
  precio: PrecioBoucherRow,
  planMeses = 1
): { montoNormal: number; admiteBecaWinston: boolean } {
  const c = normalizarConceptoNo(conceptoNo)
  let montoNormal = 0
  let admiteBecaWinston = true

  if (c === '11' || c === '12' || c === '13') {
    montoNormal = precio.precio_inscripcion
    admiteBecaWinston = false
  } else if (c === '00') {
    montoNormal = precio.precio_agosto
    admiteBecaWinston = false
  } else if (c === '16') {
    montoNormal = precio.precio_material
    admiteBecaWinston = false
  } else if (c === '17') {
    montoNormal = precio.precio_material + precio.precio_seguro
    admiteBecaWinston = false
  } else if (c === '18' || c === '19') {
    // Mitad del total Cambridge; 0 si el ciclo aún no tiene precio cargado (no inventar $975).
    montoNormal = precio.precio_cambridge > 0 ? precio.precio_cambridge / 2 : 0
    admiteBecaWinston = false
  } else if (c === '20') {
    montoNormal = precio.precio_cambridge > 0 ? precio.precio_cambridge : 0
    admiteBecaWinston = false
  } else if (c === '21') {
    montoNormal = precio.precio_cuota_padres
    admiteBecaWinston = false
  } else if (c === '26') {
    montoNormal = precio.precio_colegiatura2
    admiteBecaWinston = true
  } else if (c === '30') {
    // Pago anual: se calcula en matriz/servicio (suma plan − 5%). Aquí 0 evita doble conteo.
    montoNormal = 0
    admiteBecaWinston = false
  } else if (c === '23' || c === '24' || c === '25') {
    const tercio = precio.precio_dtitulacion > 0 ? precio.precio_dtitulacion / 3 : 0
    montoNormal = tercio
    admiteBecaWinston = false
  } else {
    montoNormal =
      planMeses === 2 ? precio.precio_colegiatura2 : precio.precio_colegiatura
    admiteBecaWinston = c !== '00' && c !== '16'
  }

  return { montoNormal, admiteBecaWinston }
}

/**
 * Importe ventanilla (sin recargo).
 * - SEP: monto fijo solo en ciclo de datos 22 (no en 23+).
 * - Winston: % de alumno_beca activa del ciclo (autorizada en becas_renovacion).
 * - Faltante SEP mal cobrado en sept. 23 → se suma a octubre (02) ya.
 */
export function calcularImporteConcepto(
  conceptoNo: string,
  precio: PrecioBoucherRow,
  porcentajeBeca: number,
  planMeses = 1,
  opts?: {
    alumnoRef?: string | number
    fecha?: Date
    cicloEscolar?: number
    /** Nuevo ingreso: 35% los primeros 15 días desde alta, 20% después. */
    alumnoNuevoIngreso?: number | string | null
    alumnoAlta?: string | null
  }
): number {
  const fecha = opts?.fecha ?? new Date()
  const c = normalizarConceptoNo(conceptoNo)
  const ciclo = opts?.cicloEscolar

  const { montoNormal, admiteBecaWinston } = montoBaseConcepto(c, precio, planMeses)

  let importe = montoNormal

  if (
    sepAplicaEnCicloCobro(ciclo) &&
    opts?.alumnoRef != null &&
    conceptoAplicaSepYRecargo(c)
  ) {
    const sep = montoBecaSep(opts.alumnoRef, ciclo)
    if (sep != null) {
      importe = sep
    } else {
      const aplicarWinston =
        admiteBecaWinston &&
        porcentajeBeca > 0 &&
        becaWinstonAplicaEnFecha(c, fecha, ciclo)
      importe = getDiscount(montoNormal, aplicarWinston ? porcentajeBeca : 0)
    }
  } else {
    const aplicarWinston =
      admiteBecaWinston &&
      porcentajeBeca > 0 &&
      becaWinstonAplicaEnFecha(c, fecha, ciclo)
    importe = getDiscount(montoNormal, aplicarWinston ? porcentajeBeca : 0)
  }

  if (opts?.alumnoRef != null && ciclo != null) {
    importe += faltanteColegiaturaPendiente({
      alumnoRef: opts.alumnoRef,
      conceptoNo: c,
      cicloEscolar: ciclo,
    })
  }

  if (c === '13' && esAlumnoNuevoIngreso(opts?.alumnoNuevoIngreso)) {
    importe = importeInscripcionNuevoIngreso(importe, {
      esNuevoIngreso: true,
      alumnoAlta: opts?.alumnoAlta,
      cicloAlumno: ciclo,
      fecha,
    })
  }

  return Math.round(importe * 100) / 100
}

export type ResultadoCalculoBoucher = {
  /** Monto ventanilla / baucher (sin recargo). */
  importe: number
  /** Monto pago en línea = importe + recargo. */
  importeLinea: number
  recargo: number
  /** Saldo a favor (recargo cuota 00) restado del importe, si aplica. */
  creditoRecargoCuotaInicio?: number
  referencia: string
  referenciaLinea: string
}

export async function calcularBoucher(
  supabase: AppDatabaseClient,
  params: {
    alumnoId: number
    alumnoRef: string | number
    alumnoNivel: number
    alumnoGrado: number
    conceptoNo: string
    cicloEscolar: number
    importeManual?: number | null
    /** 1 = 10 meses, 2 = 11 meses (campo alumno.mes). */
    planMeses?: number
    fecha?: Date
    /** Adeudos egresados: cobrar colegiatura sin recargo de atraso. */
    omitirRecargos?: boolean
    alumnoNuevoIngreso?: number | string | null
    alumnoAlta?: string | null
  }
): Promise<ResultadoCalculoBoucher> {
  const nivelPrecio = nivelPrecioBoucher(params.alumnoNivel, params.alumnoGrado)
  const fecha = params.fecha ?? new Date()

  const precio = await obtenerPrecioFila(supabase, nivelPrecio, params.cicloEscolar)
  if (!precio) {
    throw new Error(
      `No hay precios para nivel ${nivelPrecio} en el ciclo ${params.cicloEscolar}.`
    )
  }

  const becaPct = await obtenerPorcentajeBeca(
    supabase,
    params.alumnoId,
    params.cicloEscolar
  )
  const planMeses = params.planMeses ?? 1

  const manual =
    params.importeManual != null ? parseImporteBoucher(params.importeManual) : null

  let importeCorreccion: number | null = null
  if (!(manual != null && manual > 0)) {
    const corr = await obtenerCorreccionManualActiva(
      supabase,
      Number(params.alumnoRef),
      params.conceptoNo,
      params.cicloEscolar
    )
    if (corr) importeCorreccion = corr.monto
  }

  let importePagoAnual: number | null = null
  const conceptoNorm = normalizarConceptoNo(params.conceptoNo)
  if (
    conceptoNorm === '30' &&
    !(manual != null && manual > 0) &&
    importeCorreccion == null
  ) {
    // Concepto 30 no tiene precio fijo: suma del plan − 5% (mismo que la matriz).
    const { calcularMontoPagoAnual } = await import('@/lib/pagoAnualService')
    const { obtenerAlumnoPorId } = await import('@/lib/alumnoDatosService')
    const alumno = await obtenerAlumnoPorId(params.alumnoId)
    if (!alumno) {
      throw new Error('Alumno no encontrado para calcular pago anual.')
    }
    const planAnual: 1 | 2 = planMeses === 2 ? 2 : 1
    const monto = await calcularMontoPagoAnual(
      supabase,
      alumno,
      params.cicloEscolar,
      planAnual
    )
    importePagoAnual = monto.montoConDescuento
  }

  let alumnoNuevoIngreso = params.alumnoNuevoIngreso
  let alumnoAlta = params.alumnoAlta
  if (
    conceptoNorm === '13' &&
    !(manual != null && manual > 0) &&
    importeCorreccion == null &&
    (alumnoNuevoIngreso == null || alumnoAlta == null)
  ) {
    const { obtenerAlumnoPorId } = await import('@/lib/alumnoDatosService')
    const alumno = await obtenerAlumnoPorId(params.alumnoId)
    if (alumno) {
      alumnoNuevoIngreso = alumnoNuevoIngreso ?? alumno.alumno_nuevo_ingreso
      alumnoAlta = alumnoAlta ?? alumno.alumno_alta ?? null
    }
  }

  const importeBase =
    manual != null && manual > 0
      ? manual
      : importeCorreccion != null
        ? importeCorreccion
        : importePagoAnual != null
          ? importePagoAnual
          : calcularImporteConcepto(params.conceptoNo, precio, becaPct, planMeses, {
              alumnoRef: params.alumnoRef,
              fecha,
              cicloEscolar: params.cicloEscolar,
              alumnoNuevoIngreso,
              alumnoAlta,
            })

  // Crédito recargo cuota 00: después de beca/corrección; solo en el concepto destino.
  let importe = importeBase
  let creditoRecargoCuotaInicio = 0
  const conceptoNormCalc = normalizarConceptoNo(params.conceptoNo)
  const esManualForzado = manual != null && manual > 0
  if (!esManualForzado) {
    const { credito, conceptoDestino } = await resolverCreditoRecargoCuotaInicio(
      supabase,
      {
        alumnoId: params.alumnoId,
        cicloEscolar: params.cicloEscolar,
        planMeses,
      }
    )
    if (
      credito > 0 &&
      conceptoDestino != null &&
      conceptoNormCalc === normalizarConceptoNo(conceptoDestino)
    ) {
      const aplicado = aplicarCreditoRecargoAImporte(importe, credito)
      importe = aplicado.importe
      creditoRecargoCuotaInicio = aplicado.creditoAplicado
    }
  }

  const recargo =
    params.omitirRecargos ||
    (manual != null && manual > 0) ||
    importeCorreccion != null
      ? 0
      : calcularRecargoPesos(params.conceptoNo, fecha, params.cicloEscolar)
  const importeLinea = Math.round((importe + recargo) * 100) / 100

  const semibase = referenciaSemibase(
    params.alumnoRef,
    params.conceptoNo,
    params.cicloEscolar
  )
  const referencia = getDigVerif(importe, semibase)
  const referenciaLinea =
    recargo > 0 ? getDigVerif(importeLinea, semibase) : referencia

  return {
    importe,
    importeLinea,
    recargo,
    creditoRecargoCuotaInicio:
      creditoRecargoCuotaInicio > 0 ? creditoRecargoCuotaInicio : undefined,
    referencia,
    referenciaLinea,
  }
}
