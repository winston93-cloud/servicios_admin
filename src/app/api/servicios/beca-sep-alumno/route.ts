import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { resumenBecaSep, type FilaBecaSepResumen } from '@/lib/becasSep/resumenBecaSep'

export const runtime = 'nodejs'

/**
 * 2026-10-12 — Módulo Becas: Beca SEP del alumno en un ciclo (solo lectura) y la beca del colegio a la que renunció.
 * Lee alumno_beca_sep (carga inicial 2025-26 o registro automático del módulo Beca SEP desde 2026-27).
 */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const ref = Number(url.searchParams.get('ref'))
  const ciclo = Number(url.searchParams.get('ciclo'))
  if (!Number.isInteger(ref) || ref <= 0 || !Number.isInteger(ciclo) || ciclo <= 0) {
    return NextResponse.json({ ok: false, error: 'Alumno y ciclo son obligatorios.' }, { status: 400 })
  }

  const { data, error } = await createDbAdmin()
    .from('alumno_beca_sep')
    .select(
      'ciclo_valor, estatus, origen, porcentaje_sep, porcentaje_beca_actual, monto_mensual, meses_restantes, plan_meses, saldo_favor, anio_completo, fecha_otorgamiento, aprobado_en, aprobado_por, desglose'
    )
    .eq('alumno_ref', ref)
    .eq('ciclo_valor', ciclo)
    .maybeSingle()

  if (error) {
    console.error('beca-sep-alumno:', error.message)
    return NextResponse.json({ ok: false, error: 'No se pudo consultar la Beca SEP.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, sep: resumenBecaSep(data as FilaBecaSepResumen | null) })
}
