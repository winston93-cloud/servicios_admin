import type { AppDatabaseClient } from '@/lib/dbTypes'
import { hoyIso } from './portalAdmisionesCiclo'

export interface ProrrogaInscripcionActiva {
  monto: number
  vigenciaHasta: string
  concepto: number
}

/** Prórroga vigente en pago_prorroga (conceptos 11/12/13) — sin listas hardcodeadas. */
export async function obtenerProrrogaInscripcionActiva(
  supabase: AppDatabaseClient,
  alumnoRef: number,
  concepto: number,
  ciclosCandidatos: number[]
): Promise<ProrrogaInscripcionActiva | null> {
  if (![11, 12, 13].includes(concepto)) return null
  const hoy = hoyIso()

  for (const ciclo of ciclosCandidatos) {
    if (ciclo <= 0) continue

    const { data, error } = await supabase
      .from('pago_prorroga')
      .select('pago_importe, prorroga_fecha, pago_concepto, prorroga_status, prorroga_ciclo_escolar, alumno_ref')
      .eq('alumno_ref', alumnoRef)
      .eq('pago_concepto', concepto)
      .eq('prorroga_ciclo_escolar', ciclo)
      .eq('prorroga_status', 1)
      .order('prorroga_registro', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      // Esquema mínimo sin columnas extendidas: intentar por alumno_id vía join manual omitido.
      continue
    }

    const fila = data as Record<string, unknown> | null
    if (!fila) continue

    const vigencia = String(fila.prorroga_fecha ?? '').slice(0, 10)
    const monto = Number(fila.pago_importe ?? 0)
    if (!vigencia || hoy > vigencia || monto <= 0) continue

    return {
      monto,
      vigenciaHasta: vigencia,
      concepto,
    }
  }

  return null
}

/** Acceso excepcional al 2.º diferido (tabla admisiones_autorizacion_dif2). */
export async function obtenerAutorizacionPortalDif2(
  supabase: AppDatabaseClient,
  alumnoRef: number,
  cicloEscolar: number
): Promise<{
  activa: boolean
  portalAbierto: boolean
  respetarDescuento: boolean
  vigenciaHasta: string | null
  autor: string | null
}> {
  const vacio = {
    activa: false,
    portalAbierto: false,
    respetarDescuento: false,
    vigenciaHasta: null,
    autor: null,
  }

  const { data, error } = await supabase
    .from('admisiones_autorizacion_dif2')
    .select('portal_abierto, respetar_descuento, vigencia_hasta, autor, activo')
    .eq('alumno_ref', alumnoRef)
    .eq('ciclo_escolar', cicloEscolar)
    .eq('activo', 1)
    .maybeSingle()

  if (error || !data) return vacio

  const fila = data as Record<string, unknown>
  if (Number(fila.portal_abierto) !== 1) return vacio

  const vigencia = String(fila.vigencia_hasta ?? '').slice(0, 10)
  if (!vigencia || hoyIso() > vigencia) return vacio

  return {
    activa: true,
    portalAbierto: true,
    respetarDescuento: Number(fila.respetar_descuento) === 1,
    vigenciaHasta: vigencia,
    autor: fila.autor != null ? String(fila.autor) : null,
  }
}

/** Prórroga activa de Dif1 (concepto 11) sustituye lista hardcodeada refs_prorroga_dif1. */
export async function tieneAccesoProrrogaDif1(
  supabase: AppDatabaseClient,
  alumnoRef: number,
  cen: number
): Promise<boolean> {
  const pr = await obtenerProrrogaInscripcionActiva(supabase, alumnoRef, 11, [cen])
  return pr != null
}
