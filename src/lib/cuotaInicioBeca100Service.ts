import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  NIVELES_PRECIO_BOUCHER_OPCIONES,
  etiquetaNivelPrecioBoucher,
  nivelPrecioBoucher,
} from '@/lib/boucherCore'

export type CuotaInicioBeca100Nivel = {
  nivel: number
  etiqueta: string
  /** Cuota especial del ciclo anterior (0 = no capturada). */
  anterior: number
  /** Cuota especial del ciclo (0 = se cobra la cuota normal). */
  actual: number
  /** Cuota de inicio normal del ciclo, como referencia. */
  normal: number
  tieneFila: boolean
}

export type BecadoCien = {
  alumno_ref: number
  nombre: string
  nivel: number
  beca: string
}

async function cuotasPorNivel(db: AppDatabaseClient, ciclo: number) {
  const { data, error } = await db
    .from('pago_boucher_precio')
    .select('alumno_nivel, precio_agosto, precio_agosto_beca100')
    .eq('precio_ciclo_escolar', ciclo)
  if (error) throw new Error(error.message)
  return new Map(
    ((data ?? []) as Record<string, unknown>[]).map((r) => [
      Number(r.alumno_nivel),
      { normal: Number(r.precio_agosto ?? 0), beca100: Number(r.precio_agosto_beca100 ?? 0) },
    ])
  )
}

export async function listarCuotaInicioBeca100(
  db: AppDatabaseClient,
  ciclo: number
): Promise<CuotaInicioBeca100Nivel[]> {
  const [actual, anterior] = await Promise.all([cuotasPorNivel(db, ciclo), cuotasPorNivel(db, ciclo - 1)])
  return NIVELES_PRECIO_BOUCHER_OPCIONES.map((o) => ({
    nivel: o.valor,
    etiqueta: etiquetaNivelPrecioBoucher(o.valor),
    anterior: anterior.get(o.valor)?.beca100 ?? 0,
    actual: actual.get(o.valor)?.beca100 ?? 0,
    normal: actual.get(o.valor)?.normal ?? 0,
    tieneFila: actual.has(o.valor),
  }))
}

export async function guardarCuotaInicioBeca100(
  db: AppDatabaseClient,
  ciclo: number,
  montos: { nivel: number; monto: number }[]
): Promise<void> {
  for (const { nivel, monto } of montos) {
    if (!NIVELES_PRECIO_BOUCHER_OPCIONES.some((o) => o.valor === nivel)) {
      throw new Error(`Nivel inválido: ${nivel}`)
    }
    const m = Number(monto)
    if (!Number.isFinite(m) || m < 0) throw new Error('Los montos deben ser números ≥ 0')
    const { data, error } = await db
      .from('pago_boucher_precio')
      .update({ precio_agosto_beca100: Math.round(m * 100) / 100 })
      .eq('precio_ciclo_escolar', ciclo)
      .eq('alumno_nivel', nivel)
      .select('precio_id')
    if (error) throw new Error(error.message)
    if (!data?.length && m > 0) {
      throw new Error(
        `${etiquetaNivelPrecioBoucher(nivel)} no tiene precios en el ciclo ${ciclo}. Captúralos primero en «Editar costos».`
      )
    }
  }
}

/** Alumnos activos con beca autorizada del 100% en el ciclo (a quienes aplica la cuota especial). */
export async function listarBecadosCien(db: AppDatabaseClient, ciclo: number): Promise<BecadoCien[]> {
  const { data: becas, error } = await db
    .from('alumno_beca')
    .select('alumno_id, beca_id')
    .eq('beca_ciclo_escolar', ciclo)
    .eq('beca_estatus', 1)
    .gte('beca_porcentaje', 100)
  if (error) throw new Error(error.message)
  const filas = (becas ?? []) as { alumno_id: number; beca_id: number }[]
  if (!filas.length) return []

  const [{ data: alumnos, error: errA }, { data: catalogo }] = await Promise.all([
    db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado')
      .in(
        'alumno_id',
        filas.map((f) => f.alumno_id)
      )
      .neq('alumno_status', 0),
    db.from('becas_concepto_beca').select('beca_id, beca_clase'),
  ])
  if (errA) throw new Error(errA.message)
  const clase = new Map(
    ((catalogo ?? []) as { beca_id: number; beca_clase: string }[]).map((c) => [Number(c.beca_id), c.beca_clase])
  )
  const becaDe = new Map(filas.map((f) => [Number(f.alumno_id), clase.get(Number(f.beca_id)) ?? '']))

  return ((alumnos ?? []) as Record<string, unknown>[])
    .map((a) => ({
      alumno_ref: Number(a.alumno_ref),
      nombre: [a.alumno_app, a.alumno_apm, a.alumno_nombre].map((x) => String(x ?? '').trim()).filter(Boolean).join(' '),
      nivel: nivelPrecioBoucher(Number(a.alumno_nivel), Number(a.alumno_grado)),
      beca: becaDe.get(Number(a.alumno_id)) ?? '',
    }))
    .sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es'))
}
