import type { AppDatabaseClient } from './dbTypes'
import { supabase } from './supabase'
import {
  registrarEventoContactoAuditoria,
  type ActorContactoAuditoria,
} from './alumnoContactoAuditoriaService'

/** 1 = contacto de emergencias; 2 = persona autorizada para recoger al alumno. */
export const CONTACTO_TIPO_EMERGENCIA = 1
export const CONTACTO_TIPO_AUTORIZADA = 2

/** 2026-09-25: contexto opcional para historial (APIs admin / portal). */
export interface ContactoAuditoriaOpts {
  db?: AppDatabaseClient
  actor?: ActorContactoAuditoria
  origen?: string
  ip?: string | null
  userAgent?: string | null
}

const SELECT_CONTACTO =
  'contacto_id, alumno_id, tutor_id, tutor_clase, contacto_tipo, contacto_nombre, contacto_tel, contacto_cel'

export interface AlumnoContactoRegistro {
  contacto_id: number
  alumno_id: number
  tutor_id?: number | null
  tutor_clase?: string | null
  contacto_tipo: number
  contacto_nombre?: string | null
  contacto_tel?: string | null
  contacto_cel?: string | null
}

export interface SnapshotPersonaAutorizada {
  nombre: string
  parentesco: string
  telefonoCasa: string
  celular: string
}

export const SNAPSHOT_PERSONA_AUTORIZADA_VACIO: SnapshotPersonaAutorizada = {
  nombre: '',
  parentesco: '',
  telefonoCasa: '',
  celular: '',
}

export function snapshotPersonaAutorizadaDesdeRegistro(
  reg: AlumnoContactoRegistro | null
): SnapshotPersonaAutorizada {
  if (!reg) return { ...SNAPSHOT_PERSONA_AUTORIZADA_VACIO }
  return {
    nombre: (reg.contacto_nombre ?? '').trim(),
    parentesco: (reg.tutor_clase ?? '').trim(),
    telefonoCasa: (reg.contacto_tel ?? '').trim(),
    celular: (reg.contacto_cel ?? '').trim(),
  }
}

export function snapshotsPersonaAutorizadaIguales(
  a: SnapshotPersonaAutorizada,
  b: SnapshotPersonaAutorizada
): boolean {
  return (
    a.nombre === b.nombre &&
    a.parentesco === b.parentesco &&
    a.telefonoCasa === b.telefonoCasa &&
    a.celular === b.celular
  )
}

export async function listarPersonasAutorizadas(
  alumnoId: number
): Promise<AlumnoContactoRegistro[]> {
  const { data, error } = await supabase
    .from('alumno_contacto')
    .select(SELECT_CONTACTO)
    .eq('alumno_id', alumnoId)
    .eq('contacto_tipo', CONTACTO_TIPO_AUTORIZADA)
    .order('contacto_id', { ascending: true })

  if (error) {
    console.error('Error al listar personas autorizadas:', error)
    return []
  }

  return (data ?? []) as AlumnoContactoRegistro[]
}

export interface GuardarPersonaAutorizadaPayload extends SnapshotPersonaAutorizada {
  alumnoId: number
  contactoId: number | null
}

export type ResultadoGuardarPersonaAutorizada =
  | { ok: true; contactoId: number }
  | { ok: false; mensaje: string }

function esErrorClaveDuplicada(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || (error.message?.includes('duplicate key') ?? false)
}

async function obtenerSiguienteContactoId(): Promise<number | null> {
  const { data, error } = await supabase
    .from('alumno_contacto')
    .select('contacto_id')
    .order('contacto_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener siguiente contacto_id:', error)
    return null
  }

  return (data?.contacto_id ?? 0) + 1
}

export async function guardarPersonaAutorizada(
  payload: GuardarPersonaAutorizadaPayload,
  auditoria?: ContactoAuditoriaOpts
): Promise<ResultadoGuardarPersonaAutorizada> {
  // 2026-09-25: db admin en APIs; cliente browser sigue usando supabase proxy
  const db = auditoria?.db ?? supabase
  const fila = {
    contacto_nombre: payload.nombre.trim() || null,
    tutor_clase: payload.parentesco.trim() || null,
    contacto_tel: payload.telefonoCasa.trim() || null,
    contacto_cel: payload.celular.trim() || null,
    contacto_tipo: CONTACTO_TIPO_AUTORIZADA,
  }

  async function leerBefore(contactoId: number) {
    const { data } = await db
      .from('alumno_contacto')
      .select(SELECT_CONTACTO)
      .eq('contacto_id', contactoId)
      .maybeSingle()
    return (data as Record<string, unknown> | null) ?? null
  }

  async function auditar(
    accion: 'contacto.insert' | 'contacto.update',
    contactoId: number,
    before: Record<string, unknown> | null
  ) {
    if (!auditoria?.actor) return
    const after = {
      ...fila,
      contacto_id: contactoId,
      alumno_id: payload.alumnoId,
    }
    await registrarEventoContactoAuditoria(db, {
      actor: auditoria.actor,
      accion,
      entidad: 'alumno_contacto',
      entidadId: contactoId,
      alumnoId: payload.alumnoId,
      detalle: {
        origen: auditoria.origen ?? 'app',
        before,
        after,
        contacto_tipo: CONTACTO_TIPO_AUTORIZADA,
        parentesco: payload.parentesco.trim() || null,
      },
      ip: auditoria.ip,
      userAgent: auditoria.userAgent,
    })
  }

  if (payload.contactoId != null) {
    const before = await leerBefore(payload.contactoId)
    const { error } = await db
      .from('alumno_contacto')
      .update(fila)
      .eq('contacto_id', payload.contactoId)
      .eq('alumno_id', payload.alumnoId)

    if (error) {
      console.error('Error al actualizar persona autorizada:', error)
      return { ok: false, mensaje: error.message }
    }

    await auditar('contacto.update', payload.contactoId, before)
    return { ok: true, contactoId: payload.contactoId }
  }

  const filaInsert = {
    alumno_id: payload.alumnoId,
    ...fila,
    contacto_alta: new Date().toISOString(),
  }

  let { data, error } = await db
    .from('alumno_contacto')
    .insert(filaInsert)
    .select('contacto_id')
    .single()

  if (error && esErrorClaveDuplicada(error)) {
    const siguienteId =
      auditoria?.db != null
        ? await (async () => {
            const { data: maxRow } = await db
              .from('alumno_contacto')
              .select('contacto_id')
              .order('contacto_id', { ascending: false })
              .limit(1)
              .maybeSingle()
            return (maxRow?.contacto_id ?? 0) + 1
          })()
        : await obtenerSiguienteContactoId()
    if (siguienteId != null) {
      const reintento = await db
        .from('alumno_contacto')
        .insert({ ...filaInsert, contacto_id: siguienteId })
        .select('contacto_id')
        .single()
      data = reintento.data
      error = reintento.error
    }
  }

  if (error || data == null) {
    console.error('Error al crear persona autorizada:', error)
    return {
      ok: false,
      mensaje: error?.message ?? 'No se pudo crear el contacto.',
    }
  }

  await auditar('contacto.insert', data.contacto_id, null)
  return { ok: true, contactoId: data.contacto_id }
}

export type ResultadoEliminarPersonaAutorizada =
  | { ok: true }
  | { ok: false; mensaje: string }

export async function eliminarPersonaAutorizada(
  alumnoId: number,
  contactoId: number,
  auditoria?: ContactoAuditoriaOpts
): Promise<ResultadoEliminarPersonaAutorizada> {
  // 2026-09-25: leer before + auditar delete (historial sobrevive al hard delete)
  const db = auditoria?.db ?? supabase
  const { data: beforeRow } = await db
    .from('alumno_contacto')
    .select(SELECT_CONTACTO)
    .eq('contacto_id', contactoId)
    .eq('alumno_id', alumnoId)
    .eq('contacto_tipo', CONTACTO_TIPO_AUTORIZADA)
    .maybeSingle()

  const { error } = await db
    .from('alumno_contacto')
    .delete()
    .eq('contacto_id', contactoId)
    .eq('alumno_id', alumnoId)
    .eq('contacto_tipo', CONTACTO_TIPO_AUTORIZADA)

  if (error) {
    console.error('Error al eliminar persona autorizada:', error)
    return { ok: false, mensaje: error.message }
  }

  if (auditoria?.actor) {
    const before = (beforeRow as Record<string, unknown> | null) ?? null
    await registrarEventoContactoAuditoria(db, {
      actor: auditoria.actor,
      accion: 'contacto.delete',
      entidad: 'alumno_contacto',
      entidadId: contactoId,
      alumnoId,
      detalle: {
        origen: auditoria.origen ?? 'app',
        before,
        contacto_tipo: CONTACTO_TIPO_AUTORIZADA,
        parentesco: before?.tutor_clase ?? null,
      },
      ip: auditoria.ip,
      userAgent: auditoria.userAgent,
    })
  }

  return { ok: true }
}
