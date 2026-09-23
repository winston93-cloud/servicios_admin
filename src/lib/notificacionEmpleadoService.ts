import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import {
  enviarCorreoMasivo,
  htmlCuerpoCorreoMasivo,
  urlBaseCorreos,
} from '@/lib/emailServicios'
import { nombreCompletoUsuario } from '@/lib/usuarioCatalogoService'

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

export type UsuarioNotifItem = {
  usuario_id: number
  nombre: string
  email: string
  username: string
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

function mapUsuarioBusqueda(r: Record<string, unknown>): UsuarioNotifItem {
  const nombre =
    nombreCompletoUsuario({
      usuario_nombre: r.usuario_nombre == null ? null : String(r.usuario_nombre),
      usuario_app: r.usuario_app == null ? null : String(r.usuario_app),
      usuario_apm: r.usuario_apm == null ? null : String(r.usuario_apm),
    }) || String(r.usuario_username ?? '').trim()
  return {
    usuario_id: n(r.usuario_id),
    nombre,
    email: String(r.usuario_email ?? '').trim(),
    username: String(r.usuario_username ?? '').trim(),
  }
}

/** Búsqueda autocomplete de empleados activos (sin password). */
export async function buscarUsuariosParaNotificar(
  query: string,
  limit = 12
): Promise<UsuarioNotifItem[]> {
  const q = String(query ?? '').trim().toLowerCase()
  if (q.length < 2) return []

  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('usuario')
    .select(
      'usuario_id, usuario_nombre, usuario_app, usuario_apm, usuario_username, usuario_email, usuario_status'
    )
    .order('usuario_nombre', { ascending: true })
    .limit(500)

  if (error) throw new Error(error.message)

  const max = Math.min(30, Math.max(1, limit))
  const out: UsuarioNotifItem[] = []
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    if (Number(raw.usuario_status) === 0) continue
    const item = mapUsuarioBusqueda(raw)
    const blob = `${item.nombre} ${item.username} ${item.email}`.toLowerCase()
    if (!blob.includes(q)) continue
    out.push(item)
    if (out.length >= max) break
  }
  return out
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

/**
 * Crea notificación in-app + correo institucional a cada destinatario.
 */
export async function enviarNotificacionMasivaEmpleados(opts: {
  usuarioIds: number[]
  asunto: string
  mensaje: string
  enviadoPor: string
}): Promise<
  | {
      ok: true
      enviadas: number
      correosOk: number
      sinCorreo: string[]
      errores: string[]
    }
  | { ok: false; message: string }
> {
  const ids = [...new Set((opts.usuarioIds ?? []).map(n).filter((id) => id > 0))]
  if (!ids.length) return { ok: false, message: 'Selecciona al menos un destinatario.' }
  if (ids.length > 40) return { ok: false, message: 'Máximo 40 destinatarios por envío.' }

  const asunto = String(opts.asunto ?? '').trim().slice(0, 200)
  const mensaje = String(opts.mensaje ?? '').trim().slice(0, 8000)
  if (!asunto || !mensaje) return { ok: false, message: 'Asunto y mensaje requeridos.' }

  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('usuario')
    .select(
      'usuario_id, usuario_nombre, usuario_app, usuario_apm, usuario_username, usuario_email, usuario_status, nivel'
    )
    .in('usuario_id', ids)

  if (error) return { ok: false, message: error.message }

  const porId = new Map<number, Record<string, unknown>>()
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    porId.set(n(r.usuario_id), r)
  }

  const por = String(opts.enviadoPor ?? '').trim() || 'Administración'
  const dashboardUrl = `${urlBaseCorreos()}/dashboard`
  let enviadas = 0
  let correosOk = 0
  const sinCorreo: string[] = []
  const errores: string[] = []

  for (const id of ids) {
    const u = porId.get(id)
    if (!u || Number(u.usuario_status) === 0) {
      errores.push(`Usuario #${id} no encontrado o inactivo`)
      continue
    }
    const dest = mapUsuarioBusqueda(u)
    const created = await crearNotificacionEmpleado({
      usuarioId: id,
      asunto,
      mensaje,
    })
    if (!created.ok) {
      errores.push(`${dest.nombre || `#${id}`}: ${created.message}`)
      continue
    }
    enviadas += 1

    const email = dest.email.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sinCorreo.push(dest.nombre || dest.username || `#${id}`)
      continue
    }

    const cuerpoTxt = [
      `Hola ${dest.nombre || dest.username},`,
      ``,
      `Tienes una nueva notificación en Servicios Administrativos.`,
      ``,
      `De: ${por}`,
      `Asunto: ${asunto}`,
      ``,
      mensaje,
      ``,
      `Entra al dashboard para verla en la campanita:`,
      dashboardUrl,
    ].join('\n')

    const nivel = Number.isFinite(Number(u.nivel)) ? Number(u.nivel) : 0
    const mail = await enviarCorreoMasivo({
      to: [email],
      subject: `[Winston] Notificación: ${asunto}`.slice(0, 180),
      html: htmlCuerpoCorreoMasivo(cuerpoTxt, nivel),
      nivel,
    })
    if (mail.ok) correosOk += 1
    else errores.push(`Correo a ${email}: ${mail.error || 'falló'}`)
  }

  if (enviadas === 0) {
    return {
      ok: false,
      message: errores[0] || 'No se pudo enviar ninguna notificación.',
    }
  }

  return { ok: true, enviadas, correosOk, sinCorreo, errores }
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
