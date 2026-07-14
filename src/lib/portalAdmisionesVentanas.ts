import type { AppDatabaseClient } from '@/lib/dbTypes'

export interface VentanasInscripcion {
  fechaIniDif1: string | null
  fechaFinDif1: string | null
  fechaIniDif2: string | null
  fechaFinDif2: string | null
}

function fechaValida(valor: unknown): string | null {
  const s = String(valor ?? '').slice(0, 10)
  return s && s !== '0000-00-00' ? s : null
}

export async function obtenerVentanasInscripcion(
  supabase: AppDatabaseClient,
  cen: number,
  alumnoMes: number
): Promise<VentanasInscripcion> {
  const vacio: VentanasInscripcion = {
    fechaIniDif1: null,
    fechaFinDif1: null,
    fechaIniDif2: null,
    fechaFinDif2: null,
  }

  const { data, error } = await supabase
    .from('iwc_gral_ins')
    .select('*')
    .eq('ins_ce', cen)
    .maybeSingle()

  if (error || !data) return vacio

  const fila = data as Record<string, unknown>
  // Plan 10 meses (mes=1) usa columnas legacy ins_cambio_lv_*;
  // plan 11 meses usa ins_normal_* (igual que prorroga_inscripcion.php).
  const usarPlan10Meses = alumnoMes === 1

  return {
    fechaIniDif1: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif1_ini : fila.ins_normal_dif1_ini
    ),
    fechaFinDif1: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif1_fin : fila.ins_normal_dif1_fin
    ),
    fechaIniDif2: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif2_ini : fila.ins_normal_dif2_ini
    ),
    fechaFinDif2: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif2_fin : fila.ins_normal_dif2_fin
    ),
  }
}
