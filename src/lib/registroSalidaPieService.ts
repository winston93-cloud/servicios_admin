import type { AppDatabaseClient } from './dbTypes'
import {
  bloqueadoDespuesDeLaUna,
  diasSemanaNormalizados,
  instanteMexico,
  type DiaSemanaPie,
} from './diasSemanaPie'

export type RegistroSalidaPie = {
  id: number
  alumno_ref: string
  tipo_registro: 'permanente' | 'eventual'
  dias_semana: string[] | null
  fechas_especificas: string[] | null
  cancelaciones_usadas: number | null
  activo: boolean
  created_at?: string
  updated_at?: string
}

const SELECT =
  'id, alumno_ref, tipo_registro, dias_semana, fechas_especificas, cancelaciones_usadas, activo, created_at, updated_at'

const TUTOR_PLACEHOLDER = {
  nombre_tutor: 'N/A',
  email_tutor: 'N/A',
  telefono_tutor: 'N/A',
}

function refTexto(ref: number | string): string {
  return String(ref).trim()
}

function fechasIso(lista: unknown): string[] {
  if (!Array.isArray(lista)) return []
  const hoy = instanteMexico().iso
  const limite = new Date(`${hoy}T12:00:00-06:00`)
  limite.setUTCDate(limite.getUTCDate() + 15)
  const limiteIso = limite.toISOString().slice(0, 10)
  const out: string[] = []
  for (const raw of lista) {
    const f = String(raw ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue
    if (f < hoy) continue
    if (f > limiteIso) continue
    const dow = new Date(`${f}T12:00:00-06:00`).getDay()
    if (dow === 0 || dow === 6) continue
    if (!out.includes(f)) out.push(f)
  }
  return out.sort()
}

export async function listarRegistrosSalidaPie(
  alumnoRef: number | string,
  db: AppDatabaseClient
): Promise<RegistroSalidaPie[]> {
  const { data, error } = await db
    .from('registro_salida_pie')
    .select(SELECT)
    .eq('alumno_ref', refTexto(alumnoRef))
    .eq('activo', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RegistroSalidaPie[]
}

export async function toggleDiaPermanente(
  alumnoRef: number | string,
  dia: DiaSemanaPie,
  activar: boolean,
  db: AppDatabaseClient
): Promise<{ ok: true; registro: RegistroSalidaPie | null } | { ok: false; mensaje: string }> {
  if (bloqueadoDespuesDeLaUna({ dia })) {
    return { ok: false, mensaje: `No se puede cambiar ${dia} después de la 1:00 p.m. del mismo día.` }
  }

  const ref = refTexto(alumnoRef)
  const { data: registro, error: fetchError } = await db
    .from('registro_salida_pie')
    .select(SELECT)
    .eq('alumno_ref', ref)
    .eq('tipo_registro', 'permanente')
    .eq('activo', true)
    .maybeSingle()
  if (fetchError) return { ok: false, mensaje: fetchError.message }

  const actual = registro as RegistroSalidaPie | null
  const dias = diasSemanaNormalizados(actual?.dias_semana)

  if (activar) {
    if (dias.includes(dia)) return { ok: true, registro: actual }
    const nuevos = [...dias, dia]
    if (!actual) {
      const { data: creado, error } = await db
        .from('registro_salida_pie')
        .insert([
          {
            alumno_ref: ref,
            tipo_registro: 'permanente',
            dias_semana: nuevos,
            cancelaciones_usadas: 0,
            activo: true,
            ...TUTOR_PLACEHOLDER,
          },
        ])
        .select(SELECT)
        .maybeSingle()
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true, registro: creado as RegistroSalidaPie }
    }
    const { data: actualizado, error } = await db
      .from('registro_salida_pie')
      .update({ dias_semana: nuevos })
      .eq('id', actual.id)
      .select(SELECT)
      .maybeSingle()
    if (error) return { ok: false, mensaje: error.message }
    return { ok: true, registro: actualizado as RegistroSalidaPie }
  }

  if (!actual) return { ok: false, mensaje: 'No hay registro permanente activo.' }
  if (!dias.includes(dia)) return { ok: false, mensaje: 'Ese día no está activo.' }
  if ((actual.cancelaciones_usadas || 0) >= 5) {
    return { ok: false, mensaje: 'Ya usó las 5 cancelaciones permitidas.' }
  }
  const nuevos = dias.filter((d) => d !== dia)
  // array_length([], 1) es NULL en Postgres y rompe el CHECK max_5_dias.
  const { data: actualizado, error } = await db
    .from('registro_salida_pie')
    .update({
      dias_semana: nuevos.length > 0 ? nuevos : null,
      cancelaciones_usadas: (actual.cancelaciones_usadas || 0) + 1,
    })
    .eq('id', actual.id)
    .select(SELECT)
    .maybeSingle()
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, registro: actualizado as RegistroSalidaPie }
}

export async function agregarFechasEventuales(
  alumnoRef: number | string,
  fechas: string[],
  db: AppDatabaseClient
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const nuevas = fechasIso(fechas)
  if (nuevas.length === 0) return { ok: false, mensaje: 'Selecciona al menos una fecha válida.' }
  if (nuevas.some((f) => bloqueadoDespuesDeLaUna({ fecha: f }))) {
    return { ok: false, mensaje: 'No se puede incluir el día de hoy después de la 1:00 p.m.' }
  }

  const ref = refTexto(alumnoRef)
  const { data: existentes, error: listErr } = await db
    .from('registro_salida_pie')
    .select(SELECT)
    .eq('alumno_ref', ref)
    .eq('tipo_registro', 'eventual')
  if (listErr) return { ok: false, mensaje: listErr.message }

  const activos = (existentes ?? []).filter(
    (r) => r.activo && Array.isArray(r.fechas_especificas) && r.fechas_especificas.length > 0
  ) as RegistroSalidaPie[]
  const consolidadas = [...new Set([...activos.flatMap((r) => r.fechas_especificas ?? []), ...nuevas])]

  const { error: delErr } = await db
    .from('registro_salida_pie')
    .delete()
    .eq('alumno_ref', ref)
    .eq('tipo_registro', 'eventual')
  if (delErr) return { ok: false, mensaje: delErr.message }

  const { error: insErr } = await db.from('registro_salida_pie').insert([
    {
      alumno_ref: ref,
      tipo_registro: 'eventual',
      activo: true,
      fechas_especificas: consolidadas,
      ...TUTOR_PLACEHOLDER,
    },
  ])
  if (insErr) return { ok: false, mensaje: insErr.message }
  return { ok: true }
}

export async function eliminarFechaEventual(
  alumnoRef: number | string,
  registroId: number,
  fecha: string,
  db: AppDatabaseClient
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const f = String(fecha ?? '').slice(0, 10)
  if (bloqueadoDespuesDeLaUna({ fecha: f })) {
    return { ok: false, mensaje: 'No se puede quitar el día de hoy después de la 1:00 p.m.' }
  }

  const { data: registro, error: getErr } = await db
    .from('registro_salida_pie')
    .select('id, alumno_ref, tipo_registro, fechas_especificas')
    .eq('id', registroId)
    .maybeSingle()
  if (getErr || !registro) return { ok: false, mensaje: 'Registro no encontrado.' }
  if (String(registro.alumno_ref) !== refTexto(alumnoRef)) {
    return { ok: false, mensaje: 'No autorizado.' }
  }
  if (registro.tipo_registro !== 'eventual') {
    return { ok: false, mensaje: 'Ese registro no es un día eventual.' }
  }

  const restantes = (registro.fechas_especificas || []).filter((x: string) => x !== f)
  if (restantes.length === 0) {
    const { error } = await db
      .from('registro_salida_pie')
      .update({ activo: false, fechas_especificas: [] })
      .eq('id', registroId)
    if (error) return { ok: false, mensaje: error.message }
    return { ok: true }
  }
  const { error } = await db
    .from('registro_salida_pie')
    .update({ fechas_especificas: restantes })
    .eq('id', registroId)
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true }
}
