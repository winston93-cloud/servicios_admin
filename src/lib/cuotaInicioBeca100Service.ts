import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  NIVELES_PRECIO_BOUCHER_OPCIONES,
  etiquetaNivelPrecioBoucher,
  nivelPrecioBoucher,
} from '@/lib/boucherCore'

export type CuotaInicioBeca100Nivel = {
  nivel: number
  etiqueta: string
  /** Cuota de inicio total del ciclo (precio_agosto). */
  total: number
  /** % que se baja de la cuota total (0 = se cobra la cuota total). */
  pct: number
  tieneFila: boolean
}

export type BecadoCien = {
  alumno_ref: number
  nombre: string
  nivel: number
  beca: string
}

export async function listarCuotaInicioBeca100(
  db: AppDatabaseClient,
  ciclo: number
): Promise<CuotaInicioBeca100Nivel[]> {
  const { data, error } = await db
    .from('pago_boucher_precio')
    .select('alumno_nivel, precio_agosto, pct_agosto_beca100')
    .eq('precio_ciclo_escolar', ciclo)
  if (error) throw new Error(error.message)
  const porNivel = new Map(
    ((data ?? []) as Record<string, unknown>[]).map((r) => [
      Number(r.alumno_nivel),
      { total: Number(r.precio_agosto ?? 0), pct: Number(r.pct_agosto_beca100 ?? 0) },
    ])
  )
  return NIVELES_PRECIO_BOUCHER_OPCIONES.map((o) => ({
    nivel: o.valor,
    etiqueta: etiquetaNivelPrecioBoucher(o.valor),
    total: porNivel.get(o.valor)?.total ?? 0,
    pct: porNivel.get(o.valor)?.pct ?? 0,
    tieneFila: porNivel.has(o.valor),
  }))
}

export async function guardarCuotaInicioBeca100(
  db: AppDatabaseClient,
  ciclo: number,
  porcentajes: { nivel: number; pct: number }[]
): Promise<void> {
  for (const { nivel, pct } of porcentajes) {
    if (!NIVELES_PRECIO_BOUCHER_OPCIONES.some((o) => o.valor === nivel)) {
      throw new Error(`Nivel inválido: ${nivel}`)
    }
    const p = Number(pct)
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error('El porcentaje debe estar entre 0 y 100')
    const { data, error } = await db
      .from('pago_boucher_precio')
      .update({ pct_agosto_beca100: Math.round(p * 100) / 100 })
      .eq('precio_ciclo_escolar', ciclo)
      .eq('alumno_nivel', nivel)
      .select('precio_id')
    if (error) throw new Error(error.message)
    if (!data?.length && p > 0) {
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
