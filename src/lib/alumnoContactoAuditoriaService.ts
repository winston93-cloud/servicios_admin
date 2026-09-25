/**
 * 2026-09-25: Historial append-only de familiares y contactos (comunicados / quién recoge).
 */
import type { AppDatabaseClient } from './dbTypes'

export type ActorTipoContactoAuditoria = 'staff' | 'portal' | 'sistema'

export type AccionContactoAuditoria =
  | 'familiar.insert'
  | 'familiar.update'
  | 'familiar.recibir_email'
  | 'familiar.snapshot'
  | 'contacto.insert'
  | 'contacto.update'
  | 'contacto.delete'
  | 'contacto.snapshot'

export type EntidadContactoAuditoria = 'alumno_familiar' | 'alumno_contacto'

export interface ActorContactoAuditoria {
  tipo: ActorTipoContactoAuditoria
  id?: string | null
  label: string
}

export interface RegistrarEventoContactoAuditoriaInput {
  actor: ActorContactoAuditoria
  accion: AccionContactoAuditoria
  entidad: EntidadContactoAuditoria
  entidadId: number | null
  alumnoId: number
  detalle?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

export interface AlumnoContactoAuditoriaRegistro {
  id: number
  created_at: string
  actor_tipo: ActorTipoContactoAuditoria
  actor_id: string | null
  actor_label: string
  accion: string
  entidad: EntidadContactoAuditoria
  entidad_id: number | null
  alumno_id: number
  detalle: Record<string, unknown>
  ip: string | null
  user_agent: string | null
}

const SELECT_AUDITORIA =
  'id, created_at, actor_tipo, actor_id, actor_label, accion, entidad, entidad_id, alumno_id, detalle, ip, user_agent'

export async function registrarEventoContactoAuditoria(
  db: AppDatabaseClient,
  input: RegistrarEventoContactoAuditoriaInput
): Promise<{ ok: true; id: number } | { ok: false; mensaje: string }> {
  const { data, error } = await db
    .from('alumno_contacto_auditoria')
    .insert({
      actor_tipo: input.actor.tipo,
      actor_id: input.actor.id?.trim() || null,
      actor_label: input.actor.label.trim() || input.actor.tipo,
      accion: input.accion,
      entidad: input.entidad,
      entidad_id: input.entidadId,
      alumno_id: input.alumnoId,
      detalle: input.detalle ?? {},
      ip: input.ip?.trim() || null,
      user_agent: input.userAgent?.trim() || null,
    })
    .select('id')
    .single()

  if (error || data == null) {
    console.error('Error al registrar auditoría de contacto:', error)
    return { ok: false, mensaje: error?.message ?? 'No se pudo registrar auditoría.' }
  }

  return { ok: true, id: Number(data.id) }
}

export async function listarContactoAuditoriaPorAlumno(
  db: AppDatabaseClient,
  alumnoId: number,
  opts?: { limit?: number; accionPrefijo?: string }
): Promise<AlumnoContactoAuditoriaRegistro[]> {
  let q = db
    .from('alumno_contacto_auditoria')
    .select(SELECT_AUDITORIA)
    .eq('alumno_id', alumnoId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 200)

  if (opts?.accionPrefijo) {
    q = q.like('accion', `${opts.accionPrefijo}%`)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error al listar auditoría de contacto:', error)
    return []
  }

  return (data ?? []) as AlumnoContactoAuditoriaRegistro[]
}

/** Resumen legible para timeline UI. */
export function resumenEventoContactoAuditoria(
  ev: AlumnoContactoAuditoriaRegistro
): string {
  const d = ev.detalle ?? {}
  const after = (d.after as Record<string, unknown> | undefined) ?? {}
  const before = (d.before as Record<string, unknown> | undefined) ?? {}

  if (ev.accion.startsWith('familiar.')) {
    const tutorId = Number(d.tutor_id ?? after.tutor_id ?? before.tutor_id ?? 0)
    const rol = tutorId === 1 ? 'Mamá' : tutorId === 2 ? 'Papá' : 'Familiar'
    const nombre = [
      after.familiar_nombre ?? before.familiar_nombre,
      after.familiar_app ?? before.familiar_app,
      after.familiar_apm ?? before.familiar_apm,
    ]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')

    if (ev.accion === 'familiar.recibir_email') {
      const prev = before.familiar_recibir_email
      const next = after.familiar_recibir_email
      return `${rol}${nombre ? ` · ${nombre}` : ''}: correos ${prev} → ${next}`
    }
    if (ev.accion === 'familiar.insert' || ev.accion === 'familiar.snapshot') {
      return `${rol} alta${nombre ? `: ${nombre}` : ''}`
    }
    return `${rol} actualización${nombre ? `: ${nombre}` : ''}`
  }

  const tipo = Number(d.contacto_tipo ?? after.contacto_tipo ?? before.contacto_tipo ?? 0)
  const clase = tipo === 1 ? 'Emergencia' : tipo === 2 ? 'Autorizado (recoge)' : 'Contacto'
  const nombre = String(
    after.contacto_nombre ?? before.contacto_nombre ?? d.parentesco ?? ''
  ).trim()
  const parentesco = String(
    d.parentesco ?? after.tutor_clase ?? before.tutor_clase ?? ''
  ).trim()

  if (ev.accion === 'contacto.delete') {
    return `${clase} baja${nombre ? `: ${nombre}` : ''}${parentesco ? ` (${parentesco})` : ''}`
  }
  if (ev.accion === 'contacto.insert' || ev.accion === 'contacto.snapshot') {
    return `${clase} alta${nombre ? `: ${nombre}` : ''}${parentesco ? ` · ${parentesco}` : ''}`
  }
  return `${clase} actualización${nombre ? `: ${nombre}` : ''}`
}

export function resolverAccionFamiliar(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): AccionContactoAuditoria {
  if (!before) return 'familiar.insert'
  const prevEmail = Number(before.familiar_recibir_email ?? -1)
  const nextEmail = Number(after.familiar_recibir_email ?? -1)
  const soloEmail =
    prevEmail !== nextEmail &&
    String(before.familiar_app ?? '') === String(after.familiar_app ?? '') &&
    String(before.familiar_apm ?? '') === String(after.familiar_apm ?? '') &&
    String(before.familiar_nombre ?? '') === String(after.familiar_nombre ?? '') &&
    String(before.familiar_email ?? '') === String(after.familiar_email ?? '') &&
    String(before.familiar_tel ?? '') === String(after.familiar_tel ?? '') &&
    String(before.familiar_cel ?? '') === String(after.familiar_cel ?? '') &&
    String(before.familiar_empresa_tel ?? '') === String(after.familiar_empresa_tel ?? '') &&
    String(before.familiar_curp ?? '') === String(after.familiar_curp ?? '')
  if (soloEmail) return 'familiar.recibir_email'
  return 'familiar.update'
}

export async function insertarBaselineContactoAuditoria(
  db: AppDatabaseClient,
  opts?: { alumnoId?: number }
): Promise<{ familiares: number; contactos: number }> {
  const nota = `baseline historial ${new Date().toISOString().slice(0, 10)}`
  let familiares = 0
  let contactos = 0

  let famQ = db
    .from('alumno_familiar')
    .select(
      'familiar_id, alumno_id, tutor_id, familiar_app, familiar_apm, familiar_nombre, familiar_tel, familiar_cel, familiar_email, familiar_recibir_email, familiar_curp, familiar_empresa_tel, familiar_registro'
    )
  if (opts?.alumnoId) famQ = famQ.eq('alumno_id', opts.alumnoId)
  const { data: fams } = await famQ.limit(20000)

  for (const row of fams ?? []) {
    const r = row as Record<string, unknown>
    const alumnoId = Number(r.alumno_id)
    const entidadId = Number(r.familiar_id)
    if (!alumnoId || !entidadId) continue
    await registrarEventoContactoAuditoria(db, {
      actor: { tipo: 'sistema', label: 'baseline' },
      accion: 'familiar.snapshot',
      entidad: 'alumno_familiar',
      entidadId,
      alumnoId,
      detalle: { origen: 'baseline', after: r, tutor_id: r.tutor_id, nota },
    })
    familiares += 1
  }

  let contQ = db
    .from('alumno_contacto')
    .select(
      'contacto_id, alumno_id, tutor_id, tutor_clase, contacto_tipo, contacto_nombre, contacto_tel, contacto_cel, contacto_alta'
    )
  if (opts?.alumnoId) contQ = contQ.eq('alumno_id', opts.alumnoId)
  const { data: conts } = await contQ.limit(20000)

  for (const row of conts ?? []) {
    const r = row as Record<string, unknown>
    const alumnoId = Number(r.alumno_id)
    const entidadId = Number(r.contacto_id)
    if (!alumnoId || !entidadId) continue
    await registrarEventoContactoAuditoria(db, {
      actor: { tipo: 'sistema', label: 'baseline' },
      accion: 'contacto.snapshot',
      entidad: 'alumno_contacto',
      entidadId,
      alumnoId,
      detalle: {
        origen: 'baseline',
        after: r,
        contacto_tipo: r.contacto_tipo,
        parentesco: r.tutor_clase,
        nota,
      },
    })
    contactos += 1
  }

  return { familiares, contactos }
}
