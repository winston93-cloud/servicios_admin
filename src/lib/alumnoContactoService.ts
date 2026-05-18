import { supabase } from './supabase'

/** 1 = contacto de emergencias; 2 = persona autorizada para recoger al alumno. */
export const CONTACTO_TIPO_EMERGENCIA = 1
export const CONTACTO_TIPO_AUTORIZADA = 2

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

export async function guardarPersonaAutorizada(
  payload: GuardarPersonaAutorizadaPayload
): Promise<ResultadoGuardarPersonaAutorizada> {
  const fila = {
    contacto_nombre: payload.nombre.trim() || null,
    tutor_clase: payload.parentesco.trim() || null,
    contacto_tel: payload.telefonoCasa.trim() || null,
    contacto_cel: payload.celular.trim() || null,
    contacto_tipo: CONTACTO_TIPO_AUTORIZADA,
  }

  if (payload.contactoId != null) {
    const { error } = await supabase
      .from('alumno_contacto')
      .update(fila)
      .eq('contacto_id', payload.contactoId)
      .eq('alumno_id', payload.alumnoId)

    if (error) {
      console.error('Error al actualizar persona autorizada:', error)
      return { ok: false, mensaje: error.message }
    }

    return { ok: true, contactoId: payload.contactoId }
  }

  const { data, error } = await supabase
    .from('alumno_contacto')
    .insert({
      alumno_id: payload.alumnoId,
      ...fila,
      contacto_alta: new Date().toISOString(),
    })
    .select('contacto_id')
    .single()

  if (error) {
    console.error('Error al crear persona autorizada:', error)
    return { ok: false, mensaje: error.message }
  }

  return { ok: true, contactoId: data.contacto_id }
}
