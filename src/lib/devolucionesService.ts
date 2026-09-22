import { createInsforgeAdmin } from '@/lib/insforgeAdmin'

export const DEVOLUCIONES_BUCKET = 'devoluciones'

export type DevolucionTarjeta = {
  id: number
  asunto: string
  realizado_por: string
  usuario_id: number | null
  storage_key: string
  storage_url: string
  mime_type: string
  slack_ok: boolean
  slack_error: string | null
  created_at: string
}

const SELECT =
  'id, asunto, realizado_por, usuario_id, storage_key, storage_url, mime_type, slack_ok, slack_error, created_at'

const MIME_OK = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function mapRow(r: Record<string, unknown>): DevolucionTarjeta {
  return {
    id: n(r.id),
    asunto: String(r.asunto ?? ''),
    realizado_por: String(r.realizado_por ?? ''),
    usuario_id: r.usuario_id == null ? null : n(r.usuario_id),
    storage_key: String(r.storage_key ?? ''),
    storage_url: String(r.storage_url ?? ''),
    mime_type: String(r.mime_type ?? 'image/png'),
    slack_ok: Boolean(r.slack_ok),
    slack_error: r.slack_error == null ? null : String(r.slack_error),
    created_at: String(r.created_at ?? ''),
  }
}

export async function listarDevoluciones(limit = 50): Promise<DevolucionTarjeta[]> {
  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('devolucion_tarjeta')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

export async function guardarDevolucion(opts: {
  asunto: string
  realizadoPor: string
  usuarioId?: number | null
  imagenBase64: string
  mimeType: string
}): Promise<{ ok: true; row: DevolucionTarjeta } | { ok: false; message: string }> {
  const realizadoPor = String(opts.realizadoPor ?? '').trim()
  if (!realizadoPor) {
    return { ok: false, message: 'Falta identificar quién realiza la devolución.' }
  }

  const mime = String(opts.mimeType || 'image/png').toLowerCase().split(';')[0].trim()
  if (!MIME_OK.has(mime)) {
    return { ok: false, message: 'El screenshot debe ser PNG, JPEG, WebP o GIF.' }
  }

  const raw = String(opts.imagenBase64 ?? '').replace(/^data:[^;]+;base64,/, '').trim()
  if (!raw || raw.length < 32) {
    return { ok: false, message: 'Pega o sube el screenshot de la autorización de Slack.' }
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(raw, 'base64')
  } catch {
    return { ok: false, message: 'No se pudo leer la imagen.' }
  }
  if (buffer.length < 64) {
    return { ok: false, message: 'La imagen está vacía o corrupta.' }
  }
  if (buffer.length > 8 * 1024 * 1024) {
    return { ok: false, message: 'La imagen supera 8 MB.' }
  }

  const asunto = String(opts.asunto ?? '').trim().slice(0, 255)
  const ext =
    mime === 'image/jpeg' || mime === 'image/jpg'
      ? 'jpg'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/gif'
          ? 'gif'
          : 'png'
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const key = `auth/${stamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const client = createInsforgeAdmin()
  const blob = new Blob([new Uint8Array(buffer)], { type: mime })
  const { data: uploaded, error: upErr } = await client.storage
    .from(DEVOLUCIONES_BUCKET)
    .upload(key, blob)
  if (upErr || !uploaded) {
    return { ok: false, message: upErr?.message || 'No se pudo subir el screenshot.' }
  }

  const storageKey = String(uploaded.key ?? key)
  const storageUrl = String(uploaded.url ?? '')

  const insert: Record<string, unknown> = {
    asunto,
    realizado_por: realizadoPor,
    usuario_id: opts.usuarioId && opts.usuarioId > 0 ? opts.usuarioId : null,
    storage_key: storageKey,
    storage_url: storageUrl,
    mime_type: mime,
    slack_ok: false,
  }

  const { data: created, error: insErr } = await client.database
    .from('devolucion_tarjeta')
    .insert([insert])
    .select(SELECT)
    .maybeSingle()

  if (insErr || !created) {
    try {
      await client.storage.from(DEVOLUCIONES_BUCKET).remove(storageKey)
    } catch {
      /* ignore */
    }
    return { ok: false, message: insErr?.message || 'No se pudo guardar el registro.' }
  }

  const row = mapRow(created as Record<string, unknown>)

  const { notificarDevolucionSlack } = await import('@/lib/slackDevoluciones')
  const slack = await notificarDevolucionSlack({
    id: row.id,
    asunto: row.asunto,
    realizadoPor: row.realizado_por,
    createdAt: row.created_at,
    imageUrl: row.storage_url,
  })

  await client.database
    .from('devolucion_tarjeta')
    .update({
      slack_ok: slack.ok,
      slack_error: slack.ok ? null : (slack.error ?? 'Error Slack').slice(0, 500),
    })
    .eq('id', row.id)

  return {
    ok: true,
    row: {
      ...row,
      slack_ok: slack.ok,
      slack_error: slack.ok ? null : (slack.error ?? 'Error Slack'),
    },
  }
}
