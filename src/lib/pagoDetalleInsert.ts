import type { AppDatabaseClient } from '@/lib/dbTypes'

const MAX_INTENTOS = 5

function esLlaveDuplicada(error: { message?: string; code?: string }): boolean {
  return error.code === '23505' || (error.message ?? '').toLowerCase().includes('duplicate key')
}

async function siguientePagoId(supabase: AppDatabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || data?.pago_id == null) return 1
  return Number(data.pago_id) + 1
}

/**
 * pago_id no tiene secuencia (max+1): dos pagos simultáneos pueden pedir el mismo id.
 * Ante llave duplicada recalcula y reintenta con pausa aleatoria corta.
 */
export async function insertarPagoDetalleConReintento(
  supabase: AppDatabaseClient,
  fila: Record<string, unknown>
): Promise<{ error: { message: string; code?: string } | null }> {
  let ultimoError: { message: string; code?: string } | null = null
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const pagoId = await siguientePagoId(supabase)
    const { error } = await supabase.from('pago_detalle').insert({ ...fila, pago_id: pagoId })
    if (!error) return { error: null }
    ultimoError = error
    if (!esLlaveDuplicada(error)) break
    await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 250)))
  }
  return { error: ultimoError }
}
