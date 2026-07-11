import type { AppDatabaseClient } from '@/lib/dbTypes'

export type FechasDiferidosRegistro = {
  ins_ce: number
  /** Plan 10 meses (alumno.mes = 1) → columnas legacy ins_cambio_lv_* */
  plan10_dif1_ini: string
  plan10_dif1_fin: string
  plan10_dif2_ini: string
  plan10_dif2_fin: string
  /** Plan 11 meses (alumno.mes = 2) → columnas legacy ins_normal_* */
  plan11_dif1_ini: string
  plan11_dif1_fin: string
  plan11_dif2_ini: string
  plan11_dif2_fin: string
}

export type FechasDiferidosInput = Omit<FechasDiferidosRegistro, 'ins_ce'>

const SELECT_FECHAS =
  'ins_ce, ins_cambio_lv_dif1_ini, ins_cambio_lv_dif1_fin, ins_cambio_lv_dif2_ini, ins_cambio_lv_dif2_fin, ins_normal_dif1_ini, ins_normal_dif1_fin, ins_normal_dif2_ini, ins_normal_dif2_fin'

function isoDate(valor: unknown): string {
  const s = String(valor ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

function mapRow(data: Record<string, unknown>): FechasDiferidosRegistro {
  return {
    ins_ce: Number(data.ins_ce),
    plan10_dif1_ini: isoDate(data.ins_cambio_lv_dif1_ini),
    plan10_dif1_fin: isoDate(data.ins_cambio_lv_dif1_fin),
    plan10_dif2_ini: isoDate(data.ins_cambio_lv_dif2_ini),
    plan10_dif2_fin: isoDate(data.ins_cambio_lv_dif2_fin),
    plan11_dif1_ini: isoDate(data.ins_normal_dif1_ini),
    plan11_dif1_fin: isoDate(data.ins_normal_dif1_fin),
    plan11_dif2_ini: isoDate(data.ins_normal_dif2_ini),
    plan11_dif2_fin: isoDate(data.ins_normal_dif2_fin),
  }
}

function assertFecha(label: string, valor: string): string {
  const s = String(valor ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${label}: fecha inválida (usa AAAA-MM-DD)`)
  }
  return s
}

function assertRango(label: string, ini: string, fin: string) {
  if (ini > fin) {
    throw new Error(`${label}: la fecha inicio no puede ser posterior al fin`)
  }
}

export function validarFechasDiferidos(input: FechasDiferidosInput): FechasDiferidosInput {
  const plan10_dif1_ini = assertFecha('Plan 10m · Dif1 inicio', input.plan10_dif1_ini)
  const plan10_dif1_fin = assertFecha('Plan 10m · Dif1 fin', input.plan10_dif1_fin)
  const plan10_dif2_ini = assertFecha('Plan 10m · Dif2 inicio', input.plan10_dif2_ini)
  const plan10_dif2_fin = assertFecha('Plan 10m · Dif2 fin', input.plan10_dif2_fin)
  const plan11_dif1_ini = assertFecha('Plan 11m · Dif1 inicio', input.plan11_dif1_ini)
  const plan11_dif1_fin = assertFecha('Plan 11m · Dif1 fin', input.plan11_dif1_fin)
  const plan11_dif2_ini = assertFecha('Plan 11m · Dif2 inicio', input.plan11_dif2_ini)
  const plan11_dif2_fin = assertFecha('Plan 11m · Dif2 fin', input.plan11_dif2_fin)

  assertRango('Plan 10m · Diferido 1', plan10_dif1_ini, plan10_dif1_fin)
  assertRango('Plan 10m · Diferido 2', plan10_dif2_ini, plan10_dif2_fin)
  assertRango('Plan 11m · Diferido 1', plan11_dif1_ini, plan11_dif1_fin)
  assertRango('Plan 11m · Diferido 2', plan11_dif2_ini, plan11_dif2_fin)

  return {
    plan10_dif1_ini,
    plan10_dif1_fin,
    plan10_dif2_ini,
    plan10_dif2_fin,
    plan11_dif1_ini,
    plan11_dif1_fin,
    plan11_dif2_ini,
    plan11_dif2_fin,
  }
}

export async function listarFechasDiferidos(
  db: AppDatabaseClient
): Promise<FechasDiferidosRegistro[]> {
  const { data, error } = await db
    .from('iwc_gral_ins')
    .select(SELECT_FECHAS)
    .order('ins_ce', { ascending: false })

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      throw new Error(
        'La tabla iwc_gral_ins no existe. Ejecuta sql/iwc_gral_ins_add.sql en InsForge.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function obtenerFechasDiferidos(
  db: AppDatabaseClient,
  ciclo: number
): Promise<FechasDiferidosRegistro | null> {
  const { data, error } = await db
    .from('iwc_gral_ins')
    .select(SELECT_FECHAS)
    .eq('ins_ce', ciclo)
    .maybeSingle()

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      throw new Error(
        'La tabla iwc_gral_ins no existe. Ejecuta sql/iwc_gral_ins_add.sql en InsForge.'
      )
    }
    throw new Error(error.message)
  }

  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function upsertFechasDiferidos(
  db: AppDatabaseClient,
  ciclo: number,
  input: FechasDiferidosInput
): Promise<FechasDiferidosRegistro> {
  if (!Number.isFinite(ciclo) || ciclo <= 0) {
    throw new Error('Ciclo escolar inválido')
  }

  const fechas = validarFechasDiferidos(input)
  const row = {
    ins_ce: ciclo,
    ins_cambio_lv_dif1_ini: fechas.plan10_dif1_ini,
    ins_cambio_lv_dif1_fin: fechas.plan10_dif1_fin,
    ins_cambio_lv_dif2_ini: fechas.plan10_dif2_ini,
    ins_cambio_lv_dif2_fin: fechas.plan10_dif2_fin,
    ins_normal_dif1_ini: fechas.plan11_dif1_ini,
    ins_normal_dif1_fin: fechas.plan11_dif1_fin,
    ins_normal_dif2_ini: fechas.plan11_dif2_ini,
    ins_normal_dif2_fin: fechas.plan11_dif2_fin,
  }

  const { data, error } = await db
    .from('iwc_gral_ins')
    .upsert(row, { onConflict: 'ins_ce' })
    .select(SELECT_FECHAS)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as Record<string, unknown>)
}

export async function copiarFechasDiferidosCiclo(
  db: AppDatabaseClient,
  cicloOrigen: number,
  cicloDestino: number
): Promise<FechasDiferidosRegistro> {
  const origen = await obtenerFechasDiferidos(db, cicloOrigen)
  if (!origen) {
    throw new Error(`No hay fechas de diferidos en el ciclo ${cicloOrigen}`)
  }
  const { ins_ce: _, ...fechas } = origen
  return upsertFechasDiferidos(db, cicloDestino, fechas)
}
