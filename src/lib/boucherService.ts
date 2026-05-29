import type { SupabaseClient } from '@supabase/supabase-js'
import { numeroCicloEscolarAdmin } from './cicloEscolarAdmin'
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'
import {
  getDigVerif,
  getDiscount,
  parseImporteBoucher,
  referenciaSemibase,
} from './boucherCore'

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
  supabase: SupabaseClient
): Promise<ConceptoBoucherOpcion[]> {
  const { data, error } = await supabase
    .from('concepto_boucher')
    .select('concepto_no, concepto_clase, concepto_tipo')
    .neq('concepto_tipo', 3)
    .order('concepto_id')

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    concepto_no: normalizarConceptoNo(r.concepto_no),
    concepto_clase: String(r.concepto_clase).trim(),
  }))
}

export async function listarPreciosPorCiclo(
  supabase: SupabaseClient,
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

async function obtenerPrecioFila(
  supabase: SupabaseClient,
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

async function obtenerPorcentajeBeca(
  supabase: SupabaseClient,
  alumnoId: number,
  cicloActual: number
): Promise<number> {
  const { data } = await supabase
    .from('alumno_beca')
    .select('beca_porcentaje')
    .eq('alumno_id', alumnoId)
    .eq('beca_estatus', 1)
    .eq('beca_ciclo_escolar', cicloActual)
    .maybeSingle()

  return data?.beca_porcentaje != null ? Number(data.beca_porcentaje) : 0
}

export function calcularImporteConcepto(
  conceptoNo: string,
  precio: PrecioBoucherRow,
  porcentajeBeca: number
): number {
  const c = normalizarConceptoNo(conceptoNo)
  let montoNormal = 0
  let aplicaDescuento = true

  if (c === '11' || c === '12' || c === '13') {
    montoNormal = precio.precio_inscripcion
    aplicaDescuento = false
  } else if (c === '00') {
    montoNormal = precio.precio_agosto
    aplicaDescuento = false
  } else if (c === '16') {
    montoNormal = precio.precio_material
    aplicaDescuento = false
  } else if (c === '17') {
    montoNormal = precio.precio_material + precio.precio_seguro
    aplicaDescuento = false
  } else if (c === '18' || c === '19') {
    montoNormal = precio.precio_cambridge > 0 ? precio.precio_cambridge / 2 : 975
    aplicaDescuento = false
  } else if (c === '20') {
    montoNormal = precio.precio_cambridge
    aplicaDescuento = false
  } else if (c === '21') {
    montoNormal = precio.precio_cuota_padres
    aplicaDescuento = false
  } else {
    montoNormal = precio.precio_colegiatura
  }

  const pct = aplicaDescuento && porcentajeBeca > 0 ? porcentajeBeca : 0
  return getDiscount(montoNormal, pct)
}

export async function calcularBoucher(
  supabase: SupabaseClient,
  params: {
    alumnoId: number
    alumnoRef: string | number
    alumnoNivel: number
    alumnoGrado: number
    conceptoNo: string
    cicloEscolar: number
    importeManual?: number | null
  }
): Promise<{ importe: number; referencia: string }> {
  const nivelPrecio =
    params.alumnoNivel === 2 && params.alumnoGrado === 1 ? 1 : params.alumnoNivel

  const precio = await obtenerPrecioFila(supabase, nivelPrecio, params.cicloEscolar)
  if (!precio) {
    throw new Error(
      `No hay precios para nivel ${nivelPrecio} en el ciclo ${params.cicloEscolar}.`
    )
  }

  const cicloActual = numeroCicloEscolarAdmin()
  const becaPct = await obtenerPorcentajeBeca(supabase, params.alumnoId, cicloActual)

  const manual =
    params.importeManual != null ? parseImporteBoucher(params.importeManual) : null
  const importe =
    manual != null && manual > 0
      ? manual
      : calcularImporteConcepto(params.conceptoNo, precio, becaPct)

  const semibase = referenciaSemibase(
    params.alumnoRef,
    params.conceptoNo,
    params.cicloEscolar
  )
  const referencia = getDigVerif(importe, semibase)

  return { importe, referencia }
}
