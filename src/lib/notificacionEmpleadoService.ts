import { createInsforgeAdmin } from '@/lib/insforgeAdmin'

export type NotificacionEmpleado = {
  id: number
  usuario_id: number
  asunto: string
  mensaje: string
  leida: boolean
  devolucion_id: number | null
  cheque_numero: number | null
  created_at: string
}

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function mapRow(r: Record<string, unknown>): NotificacionEmpleado {
  return {
    id: n(r.id),
    usuario_id: n(r.usuario_id),
    asunto: String(r.asunto ?? ''),
    mensaje: String(r.mensaje ?? ''),
    leida: Boolean(r.leida),
    devolucion_id: r.devolucion_id == null ? null : n(r.devolucion_id),
    cheque_numero: r.cheque_numero == null ? null : n(r.cheque_numero),
    created_at: String(r.created_at ?? ''),
  }
}

export async function crearNotificacionEmpleado(opts: {
  usuarioId: number
  asunto: string
  mensaje: string
  devolucionId?: number | null
  chequeNumero?: number | null
}): Promise<{ ok: true; row: NotificacionEmpleado } | { ok: false; message: string }> {
  const usuarioId = n(opts.usuarioId)
  if (usuarioId <= 0) return { ok: false, message: 'usuario_id inválido' }
  const asunto = String(opts.asunto ?? '').trim().slice(0, 200)
  const mensaje = String(opts.mensaje ?? '').trim()
  if (!asunto || !mensaje) return { ok: false, message: 'Asunto y mensaje requeridos' }

  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('notificacion_empleado')
    .insert([
      {
        usuario_id: usuarioId,
        asunto,
        mensaje,
        leida: false,
        devolucion_id: opts.devolucionId && opts.devolucionId > 0 ? opts.devolucionId : null,
        cheque_numero: opts.chequeNumero && opts.chequeNumero > 0 ? opts.chequeNumero : null,
      },
    ])
    .select('*')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, message: error?.message || 'No se pudo crear la notificación' }
  }
  return { ok: true, row: mapRow(data as Record<string, unknown>) }
}

/** Solo pendientes (no leídas) para la campanita. */
export async function listarNotificacionesEmpleado(
  usuarioId: number,
  limit = 30
): Promise<{ rows: NotificacionEmpleado[]; noLeidas: number }> {
  const uid = n(usuarioId)
  if (uid <= 0) return { rows: [], noLeidas: 0 }

  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('notificacion_empleado')
    .select('*')
    .eq('usuario_id', uid)
    .eq('leida', false)
    .order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)))

  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow)
  return { rows, noLeidas: rows.length }
}

/**
 * Marca notificación(es) como leídas.
 * Si hay devolucion_id, avanza la devolución a etapa 5 (historial cerrado).
 */
export async function marcarNotificacionesEmpleadoLeidas(opts: {
  usuarioId: number
  ids?: number[]
  realizadoPor?: string
}): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const uid = n(opts.usuarioId)
  if (uid <= 0) return { ok: false, message: 'usuario_id inválido' }

  const db = createInsforgeAdmin().database
  const ids = (opts.ids ?? []).map(n).filter((id) => id > 0)

  // Folios vinculados: por ids (si vienen) o solo no leídas.
  let qSel = db.from('notificacion_empleado').select('id, devolucion_id').eq('usuario_id', uid)
  if (ids.length) qSel = qSel.in('id', ids)
  else qSel = qSel.eq('leida', false)
  const { data: pending, error: selErr } = await qSel
  if (selErr) return { ok: false, message: selErr.message }

  let q = db
    .from('notificacion_empleado')
    .update({ leida: true })
    .eq('usuario_id', uid)
    .eq('leida', false)
  if (ids.length) q = q.in('id', ids)

  const { data, error } = await q.select('id')
  if (error) return { ok: false, message: error.message }

  const folios = [
    ...new Set(
      ((pending ?? []) as { devolucion_id?: number | null }[])
        .map((r) => n(r.devolucion_id))
        .filter((id) => id > 0)
    ),
  ]
  const por = String(opts.realizadoPor ?? '').trim().slice(0, 160) || 'sistema'
  for (const folio of folios) {
    const { error: upDevErr } = await db
      .from('devolucion_tarjeta')
      .update({
        etapa: 5,
        etapa5_at: new Date().toISOString(),
        etapa5_por: por,
      })
      .eq('id', folio)
      .lte('etapa', 4)
    if (upDevErr) {
      console.warn('[notif-empleado] no se pudo pasar folio a etapa 5:', folio, upDevErr.message)
      return { ok: false, message: `No se pudo cerrar la devolución #${folio}: ${upDevErr.message}` }
    }
  }

  return { ok: true, updated: Math.max((data ?? []).length, folios.length) }
}

/** Aviso al titular que capturó la devolución (paso 1): cheque firmado. */
export async function notificarChequeFirmadoDevolucion(opts: {
  usuarioId: number | null | undefined
  devolucionId: number
  chequeNumero: number
  asuntoDevolucion?: string
}): Promise<void> {
  const uid = n(opts.usuarioId)
  if (uid <= 0) {
    console.warn('[notif-empleado] Sin usuario_id en devolución; no se notifica')
    return
  }
  const folio = n(opts.devolucionId)
  const cheque = n(opts.chequeNumero)
  const asuntoTxt = String(opts.asuntoDevolucion ?? '').trim() || 'Devolución'
  const result = await crearNotificacionEmpleado({
    usuarioId: uid,
    asunto: `Cheque ${cheque} firmado — folio #${folio}`,
    mensaje: `El cheque ${cheque} de la devolución #${folio} (${asuntoTxt}) ya está firmado. Puedes avisar a papá/mamá que pase por él a caja o administración.`,
    devolucionId: folio,
    chequeNumero: cheque,
  })
  if (!result.ok) {
    console.warn('[notif-empleado] No se pudo notificar cheque firmado:', result.message)
  }
}
