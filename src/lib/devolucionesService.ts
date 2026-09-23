import { createInsforgeAdmin } from '@/lib/insforgeAdmin'

export const DEVOLUCIONES_BUCKET = 'devoluciones'
export const DEVOLUCION_ETAPAS_TOTAL = 4
export const ADJUNTO_MAX_BYTES = 5 * 1024 * 1024

export type DevolucionAdjunto = {
  id: number
  devolucion_id: number
  storage_key: string
  storage_url: string
  nombre_archivo: string
  mime_type: string
  bytes: number
  subido_por: string | null
  created_at: string
}

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
  etapa: number
  slack_admvo_ok: boolean
  slack_admvo_error: string | null
  etapa2_at: string | null
  etapa2_por: string | null
  cheque_numero: number | null
  cheque_entidad: string | null
  /** pendiente_firma | firmado | null */
  cheque_firma_status: string | null
  etapa3_at: string | null
  etapa3_por: string | null
  etapa4_at: string | null
  etapa4_por: string | null
  created_at: string
  adjuntos: DevolucionAdjunto[]
}

const SELECT =
  'id, asunto, realizado_por, usuario_id, storage_key, storage_url, mime_type, slack_ok, slack_error, etapa, slack_admvo_ok, slack_admvo_error, etapa2_at, etapa2_por, cheque_numero, cheque_entidad, cheque_firma_status, etapa3_at, etapa3_por, etapa4_at, etapa4_por, created_at'

const MIME_IMG = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
const MIME_ADJUNTO = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function mapAdjunto(r: Record<string, unknown>): DevolucionAdjunto {
  return {
    id: n(r.id),
    devolucion_id: n(r.devolucion_id),
    storage_key: String(r.storage_key ?? ''),
    storage_url: String(r.storage_url ?? ''),
    nombre_archivo: String(r.nombre_archivo ?? ''),
    mime_type: String(r.mime_type ?? 'application/pdf'),
    bytes: n(r.bytes),
    subido_por: r.subido_por == null ? null : String(r.subido_por),
    created_at: String(r.created_at ?? ''),
  }
}

function mapRow(r: Record<string, unknown>, adjuntos: DevolucionAdjunto[] = []): DevolucionTarjeta {
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
    etapa: Math.min(4, Math.max(1, n(r.etapa) || 1)),
    slack_admvo_ok: Boolean(r.slack_admvo_ok),
    slack_admvo_error: r.slack_admvo_error == null ? null : String(r.slack_admvo_error),
    etapa2_at: r.etapa2_at == null ? null : String(r.etapa2_at),
    etapa2_por: r.etapa2_por == null ? null : String(r.etapa2_por),
    cheque_numero: r.cheque_numero == null || n(r.cheque_numero) <= 0 ? null : n(r.cheque_numero),
    cheque_entidad: r.cheque_entidad == null ? null : String(r.cheque_entidad),
    cheque_firma_status: r.cheque_firma_status == null ? null : String(r.cheque_firma_status),
    etapa3_at: r.etapa3_at == null ? null : String(r.etapa3_at),
    etapa3_por: r.etapa3_por == null ? null : String(r.etapa3_por),
    etapa4_at: r.etapa4_at == null ? null : String(r.etapa4_at),
    etapa4_por: r.etapa4_por == null ? null : String(r.etapa4_por),
    created_at: String(r.created_at ?? ''),
    adjuntos,
  }
}

async function adjuntosDeIds(ids: number[]): Promise<Map<number, DevolucionAdjunto[]>> {
  const map = new Map<number, DevolucionAdjunto[]>()
  for (const id of ids) map.set(id, [])
  if (!ids.length) return map
  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('devolucion_tarjeta_adjunto')
    .select(
      'id, devolucion_id, storage_key, storage_url, nombre_archivo, mime_type, bytes, subido_por, created_at'
    )
    .in('devolucion_id', ids)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const a = mapAdjunto(row)
    const list = map.get(a.devolucion_id) ?? []
    list.push(a)
    map.set(a.devolucion_id, list)
  }
  return map
}

export async function listarDevoluciones(limit = 50): Promise<DevolucionTarjeta[]> {
  const db = createInsforgeAdmin().database
  const { data, error } = await db
    .from('devolucion_tarjeta')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, unknown>[]
  const adjMap = await adjuntosDeIds(rows.map((r) => n(r.id)))
  return rows.map((r) => mapRow(r, adjMap.get(n(r.id)) ?? []))
}

async function cargarDevolucion(id: number): Promise<DevolucionTarjeta | null> {
  const db = createInsforgeAdmin().database
  const { data, error } = await db.from('devolucion_tarjeta').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const adjMap = await adjuntosDeIds([id])
  return mapRow(data as Record<string, unknown>, adjMap.get(id) ?? [])
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
  if (!MIME_IMG.has(mime)) {
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
    etapa: 1,
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

  const row = mapRow(created as Record<string, unknown>, [])

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

export async function subirAdjuntosDevolucion(opts: {
  devolucionId: number
  realizadoPor: string
  archivos: { nombre: string; mimeType: string; base64: string }[]
}): Promise<{ ok: true; row: DevolucionTarjeta } | { ok: false; message: string }> {
  const realizadoPor = String(opts.realizadoPor ?? '').trim()
  if (!realizadoPor) {
    return { ok: false, message: 'Falta identificar quién sube los archivos.' }
  }
  const id = n(opts.devolucionId)
  if (id <= 0) return { ok: false, message: 'Devolución inválida.' }

  const actual = await cargarDevolucion(id)
  if (!actual) return { ok: false, message: 'No se encontró la devolución.' }
  if (actual.etapa !== 1) {
    return { ok: false, message: 'Solo se pueden adjuntar archivos en etapa 1.' }
  }
  if (!opts.archivos?.length) {
    return { ok: false, message: 'Selecciona al menos un archivo.' }
  }
  if (opts.archivos.length > 20) {
    return { ok: false, message: 'Máximo 20 archivos por carga.' }
  }

  const client = createInsforgeAdmin()
  const subidos: string[] = []

  try {
    for (const file of opts.archivos) {
      const mime = String(file.mimeType || '').toLowerCase().split(';')[0].trim()
      if (!MIME_ADJUNTO.has(mime)) {
        throw new Error(`Tipo no permitido: ${file.nombre || mime}. Usa PDF o imagen.`)
      }
      const raw = String(file.base64 ?? '').replace(/^data:[^;]+;base64,/, '').trim()
      if (!raw) throw new Error(`Archivo vacío: ${file.nombre}`)
      const buffer = Buffer.from(raw, 'base64')
      if (buffer.length > ADJUNTO_MAX_BYTES) {
        throw new Error(`${file.nombre || 'Archivo'} supera 5 MB.`)
      }
      if (buffer.length < 32) throw new Error(`Archivo inválido: ${file.nombre}`)

      const safeName = String(file.nombre || 'archivo')
        .replace(/[^\w.\-()+ ]+/g, '_')
        .slice(0, 180)
      const ext =
        mime === 'application/pdf'
          ? 'pdf'
          : mime.includes('jpeg') || mime.includes('jpg')
            ? 'jpg'
            : mime.includes('webp')
              ? 'webp'
              : mime.includes('gif')
                ? 'gif'
                : 'png'
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const key = `adjuntos/${id}/${stamp}-${Math.random().toString(36).slice(2, 7)}.${ext}`
      const blob = new Blob([new Uint8Array(buffer)], { type: mime })
      const { data: uploaded, error: upErr } = await client.storage
        .from(DEVOLUCIONES_BUCKET)
        .upload(key, blob)
      if (upErr || !uploaded) {
        throw new Error(upErr?.message || `No se pudo subir ${safeName}`)
      }
      const storageKey = String(uploaded.key ?? key)
      subidos.push(storageKey)
      const { error: insErr } = await client.database.from('devolucion_tarjeta_adjunto').insert([
        {
          devolucion_id: id,
          storage_key: storageKey,
          storage_url: String(uploaded.url ?? ''),
          nombre_archivo: safeName || `archivo.${ext}`,
          mime_type: mime,
          bytes: buffer.length,
          subido_por: realizadoPor,
        },
      ])
      if (insErr) throw new Error(insErr.message)
    }
  } catch (e) {
    for (const key of subidos) {
      try {
        await client.storage.from(DEVOLUCIONES_BUCKET).remove(key)
      } catch {
        /* ignore */
      }
    }
    return { ok: false, message: e instanceof Error ? e.message : 'Error al subir adjuntos' }
  }

  const row = await cargarDevolucion(id)
  if (!row) return { ok: false, message: 'Adjuntos subidos, pero no se pudo releer el folio.' }
  return { ok: true, row }
}

export async function enviarDevolucionAdmvo(opts: {
  devolucionId: number
  realizadoPor: string
}): Promise<{ ok: true; row: DevolucionTarjeta } | { ok: false; message: string }> {
  const realizadoPor = String(opts.realizadoPor ?? '').trim()
  if (!realizadoPor) {
    return { ok: false, message: 'Falta identificar quién envía a administración.' }
  }
  const id = n(opts.devolucionId)
  const actual = await cargarDevolucion(id)
  if (!actual) return { ok: false, message: 'No se encontró la devolución.' }
  if (actual.etapa !== 1) {
    return { ok: false, message: 'Esta devolución ya avanzó de la etapa 1.' }
  }
  if (!actual.adjuntos.length) {
    return { ok: false, message: 'Sube al menos una factura o nota de crédito antes de enviar.' }
  }

  const { notificarDevolucionAdmvoSlack } = await import('@/lib/slackDevoluciones')
  const slack = await notificarDevolucionAdmvoSlack({
    id: actual.id,
    asunto: actual.asunto,
    realizadoPor: actual.realizado_por,
    createdAt: actual.created_at,
    screenshotUrl: actual.storage_url,
    adjuntos: actual.adjuntos.map((a) => ({
      nombre: a.nombre_archivo,
      url: a.storage_url,
      mime: a.mime_type,
    })),
    enviadoPor: realizadoPor,
  })

  const client = createInsforgeAdmin()
  if (!slack.ok) {
    await client.database
      .from('devolucion_tarjeta')
      .update({
        slack_admvo_ok: false,
        slack_admvo_error: (slack.error ?? 'Error Slack').slice(0, 500),
      })
      .eq('id', id)
    return {
      ok: false,
      message: `No se pudo enviar a #devolucion_admvo: ${slack.error || 'sin detalle'}`,
    }
  }

  await client.database
    .from('devolucion_tarjeta')
    .update({
      etapa: 2,
      slack_admvo_ok: true,
      slack_admvo_error: null,
      etapa2_at: new Date().toISOString(),
      etapa2_por: realizadoPor,
    })
    .eq('id', id)

  const row = await cargarDevolucion(id)
  if (!row) return { ok: false, message: 'Enviado, pero no se pudo releer el folio.' }
  return { ok: true, row }
}

/** Etapa 3→4: marca el cheque como firmado y cierra la devolución. */
export async function completarFirmaDevolucion(opts: {
  devolucionId: number
  realizadoPor: string
}): Promise<{ ok: true; row: DevolucionTarjeta } | { ok: false; message: string }> {
  const realizadoPor = String(opts.realizadoPor ?? '').trim()
  if (!realizadoPor) {
    return { ok: false, message: 'Falta identificar quién completa la devolución.' }
  }
  const id = n(opts.devolucionId)
  const actual = await cargarDevolucion(id)
  if (!actual) return { ok: false, message: 'No se encontró la devolución.' }
  if (!actual.cheque_numero) {
    return { ok: false, message: 'Esta devolución aún no tiene cheque vinculado.' }
  }
  if (actual.cheque_firma_status === 'firmado' || actual.etapa >= 4) {
    return { ok: true, row: actual }
  }
  if (actual.cheque_firma_status !== 'pendiente_firma' && actual.etapa < 3) {
    return { ok: false, message: 'La devolución no está en pendiente de firma.' }
  }

  const client = createInsforgeAdmin()
  const { error } = await client.database
    .from('devolucion_tarjeta')
    .update({
      etapa: 4,
      cheque_firma_status: 'firmado',
      etapa4_at: new Date().toISOString(),
      etapa4_por: realizadoPor.slice(0, 160),
    })
    .eq('id', id)
  if (error) return { ok: false, message: error.message }

  const row = await cargarDevolucion(id)
  if (!row) return { ok: false, message: 'Actualizado, pero no se pudo releer el folio.' }
  return { ok: true, row }
}
