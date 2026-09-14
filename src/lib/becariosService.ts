import { createDbAdmin } from '@/lib/insforgeAdmin'
import type { BecariosSesion } from '@/lib/becariosAuth'

export type BecarioEntrada = {
  entrada_id: number
  becario_username: string
  becario_nombre: string
  entrada_fecha: string
  entrada_titulo: string
  avances: string
  observaciones: string
  apuntes: string
  pendientes: string
  aprendizajes: string
  horas_aproximadas: number | null
  estado: string
  entrada_creacion: string
  entrada_actualizacion: string
}

export type BecarioEntradaInput = {
  entrada_fecha: string
  entrada_titulo?: string
  avances: string
  observaciones?: string
  apuntes?: string
  pendientes?: string
  aprendizajes?: string
  horas_aproximadas?: number | null
  estado?: 'borrador' | 'publicado'
}

function db() {
  return createDbAdmin()
}

function asDate(v: string): string {
  const s = String(v ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Fecha inválida (usa AAAA-MM-DD)')
  return s
}

function mapRow(r: Record<string, unknown>): BecarioEntrada {
  const horas = r.horas_aproximadas
  return {
    entrada_id: Number(r.entrada_id),
    becario_username: String(r.becario_username ?? ''),
    becario_nombre: String(r.becario_nombre ?? ''),
    entrada_fecha: String(r.entrada_fecha ?? '').slice(0, 10),
    entrada_titulo: String(r.entrada_titulo ?? ''),
    avances: String(r.avances ?? ''),
    observaciones: String(r.observaciones ?? ''),
    apuntes: String(r.apuntes ?? ''),
    pendientes: String(r.pendientes ?? ''),
    aprendizajes: String(r.aprendizajes ?? ''),
    horas_aproximadas:
      horas === null || horas === undefined || horas === '' ? null : Number(horas),
    estado: String(r.estado ?? 'publicado'),
    entrada_creacion: String(r.entrada_creacion ?? ''),
    entrada_actualizacion: String(r.entrada_actualizacion ?? ''),
  }
}

export async function obtenerEntradaDia(
  session: BecariosSesion,
  fecha: string
): Promise<BecarioEntrada | null> {
  const f = asDate(fecha)
  const { data, error } = await db()
    .from('becario_bitacora')
    .select('*')
    .eq('becario_username', session.username)
    .eq('entrada_fecha', f)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function listarEntradas(
  session: BecariosSesion,
  opts: { desde?: string; hasta?: string; limit?: number } = {}
): Promise<BecarioEntrada[]> {
  let q = db()
    .from('becario_bitacora')
    .select('*')
    .eq('becario_username', session.username)
    .order('entrada_fecha', { ascending: false })
  if (opts.desde) q = q.gte('entrada_fecha', asDate(opts.desde))
  if (opts.hasta) q = q.lte('entrada_fecha', asDate(opts.hasta))
  const { data, error } = await q.limit(opts.limit ?? 120)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function guardarEntradaDia(
  session: BecariosSesion,
  input: BecarioEntradaInput
): Promise<BecarioEntrada> {
  const fecha = asDate(input.entrada_fecha)
  const avances = String(input.avances ?? '').trim()
  if (!avances) throw new Error('Describe al menos tus avances del día.')

  const payload = {
    becario_username: session.username,
    becario_nombre: session.nombre,
    entrada_fecha: fecha,
    entrada_titulo: String(input.entrada_titulo ?? '').trim(),
    avances,
    observaciones: String(input.observaciones ?? '').trim(),
    apuntes: String(input.apuntes ?? '').trim(),
    pendientes: String(input.pendientes ?? '').trim(),
    aprendizajes: String(input.aprendizajes ?? '').trim(),
    horas_aproximadas:
      input.horas_aproximadas === null || input.horas_aproximadas === undefined
        ? null
        : Number(input.horas_aproximadas),
    estado: input.estado === 'borrador' ? 'borrador' : 'publicado',
    entrada_actualizacion: new Date().toISOString(),
  }

  const existente = await obtenerEntradaDia(session, fecha)
  if (existente) {
    const { data, error } = await db()
      .from('becario_bitacora')
      .update(payload)
      .eq('entrada_id', existente.entrada_id)
      .select('*')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message || 'No se actualizó la entrada')
    return mapRow(data as Record<string, unknown>)
  }

  const { data, error } = await db()
    .from('becario_bitacora')
    .insert([{ ...payload, entrada_creacion: new Date().toISOString() }])
    .select('*')
    .maybeSingle()
  if (error || !data) throw new Error(error?.message || 'No se guardó la entrada')
  return mapRow(data as Record<string, unknown>)
}

export function inicioSemanaISO(fecha: string): string {
  const d = new Date(`${asDate(fecha)}T12:00:00`)
  const day = d.getDay() // 0 domingo
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function finSemanaISO(fecha: string): string {
  const ini = new Date(`${inicioSemanaISO(fecha)}T12:00:00`)
  ini.setDate(ini.getDate() + 6)
  return ini.toISOString().slice(0, 10)
}

export function hoyCDMX(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
