/**
 * Aviso a #avisos_devolucion al registrar una devolución de pago con tarjeta.
 * Misma idea que AgendaW (webhook Incoming); aquí además se adjunta la URL pública del screenshot.
 * Env: SLACK_WEBHOOK_SISTEMASWINSTON (URL del Incoming Webhook del canal).
 */
import 'server-only'

import { createInsforgeAdmin } from '@/lib/insforgeAdmin'

const DEVOLUCIONES_BUCKET = 'devoluciones'

export async function notificarDevolucionSlack(data: {
  id: number
  asunto: string
  realizadoPor: string
  createdAt: string
  imageUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_SISTEMASWINSTON?.trim()
  if (!webhookUrl) {
    console.warn('[slack-devoluciones] SLACK_WEBHOOK_SISTEMASWINSTON no configurado')
    return { ok: false, error: 'Webhook Slack no configurado (SLACK_WEBHOOK_SISTEMASWINSTON)' }
  }

  const fecha = formatFechaMx(data.createdAt)
  const asuntoTxt = data.asunto.trim() || '(sin asunto)'
  const text = [
    `💸 *Devolución de pago con tarjeta*`,
    ``,
    `*Folio:* #${data.id}`,
    `*Asunto:* ${asuntoTxt}`,
    `*Realizó:* ${data.realizadoPor}`,
    `*Fecha:* ${fecha}`,
  ].join('\n')

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ]

  if (data.imageUrl) {
    // Solo bloque image: un enlace aparte hace que Slack vuelva a unfurl/mostrar la misma foto.
    blocks.push({
      type: 'image',
      image_url: data.imageUrl,
      alt_text: `Autorización Slack — devolución #${data.id}`,
    })
  }

  return sendSlackWebhook(webhookUrl, text, blocks)
}

/**
 * Etapa 2: factura(s) / NC + screenshot → canal #devolucion_admvo.
 * Env: SLACK_WEBHOOK_DEVOLUCION_ADMVO
 *
 * Screenshot = solo enlace (sin unfurl).
 * Adjuntos = minidespliegue (image block; PDF → preview 1ª página).
 */
export async function notificarDevolucionAdmvoSlack(data: {
  id: number
  asunto: string
  realizadoPor: string
  createdAt: string
  screenshotUrl: string
  enviadoPor: string
  adjuntos: { nombre: string; url: string; mime: string }[]
}): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_DEVOLUCION_ADMVO?.trim()
  if (!webhookUrl) {
    console.warn('[slack-devoluciones] SLACK_WEBHOOK_DEVOLUCION_ADMVO no configurado')
    return { ok: false, error: 'Webhook Slack no configurado (SLACK_WEBHOOK_DEVOLUCION_ADMVO)' }
  }

  const archivoLinks: string[] = []
  if (data.screenshotUrl) {
    archivoLinks.push(`• <${data.screenshotUrl}|Screenshot autorización>`)
  }

  const text = [
    `🧾 *Devolución lista para administración (etapa 2/5)*`,
    ``,
    `*Folio:* #${data.id}`,
    `*Capturó:* ${data.realizadoPor}`,
    ``,
    `*Archivos (${archivoLinks.length}):*`,
    archivoLinks.join('\n') || '—',
  ].join('\n')

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ]

  let previews = 0
  for (const a of data.adjuntos) {
    if (!a.url || previews >= 5) continue
    const mime = String(a.mime || '').toLowerCase()
    const nombre = a.nombre || 'archivo'

    if (mime.startsWith('image/')) {
      blocks.push({
        type: 'image',
        image_url: a.url,
        alt_text: nombre,
      })
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `📎 <${a.url}|${nombre}>` }],
      })
      previews += 1
      continue
    }

    if (mime.includes('pdf') || /\.pdf$/i.test(nombre)) {
      const previewUrl = await generarPreviewPdfYSubir({
        pdfUrl: a.url,
        devolucionId: data.id,
        nombre,
      })
      if (previewUrl) {
        blocks.push({
          type: 'image',
          image_url: previewUrl,
          alt_text: `Vista previa — ${nombre}`,
        })
      }
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: previewUrl
              ? `📄 <${a.url}|${nombre}>`
              : `📄 *${nombre}* — <${a.url}|Abrir archivo>`,
          },
        ],
      })
      previews += 1
      continue
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📎 *${nombre}*\n<${a.url}|Abrir archivo>`,
      },
    })
  }

  // Sin unfurl: si no, Slack vuelve a expandir el screenshot al final del mensaje.
  return sendSlackWebhook(webhookUrl, text, blocks, { unfurlLinks: false, unfurlMedia: false })
}

async function generarPreviewPdfYSubir(opts: {
  pdfUrl: string
  devolucionId: number
  nombre: string
}): Promise<string | null> {
  try {
    const res = await fetch(opts.pdfUrl)
    if (!res.ok) {
      console.warn('[slack-devoluciones] No se pudo descargar PDF:', res.status, opts.pdfUrl)
      return null
    }
    const pdfBytes = new Uint8Array(await res.arrayBuffer())
    if (pdfBytes.byteLength < 64) return null

    const png = await renderPdfFirstPagePng(pdfBytes)
    if (!png?.length) return null

    const client = createInsforgeAdmin()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const key = `adjuntos/${opts.devolucionId}/preview-${stamp}-${Math.random().toString(36).slice(2, 7)}.png`
    const blob = new Blob([png], { type: 'image/png' })
    const { data: uploaded, error } = await client.storage.from(DEVOLUCIONES_BUCKET).upload(key, blob)
    if (error || !uploaded?.url) {
      console.warn('[slack-devoluciones] Upload preview falló:', error?.message)
      return null
    }
    return String(uploaded.url)
  } catch (e) {
    console.warn(
      '[slack-devoluciones] Preview PDF falló:',
      e instanceof Error ? e.message : String(e)
    )
    return null
  }
}

async function renderPdfFirstPagePng(pdfBytes: Uint8Array): Promise<Buffer | null> {
  const [{ getDocument }, { createCanvas }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('@napi-rs/canvas'),
  ])

  const loading = getDocument({
    data: pdfBytes,
    useSystemFonts: true,
  } as Parameters<typeof getDocument>[0])
  const pdf = await loading.promise
  const page = await pdf.getPage(1)
  // Escala moderada: Slack image block + límite de tamaño de webhook
  const base = page.getViewport({ scale: 1 })
  const targetW = Math.min(Math.ceil(base.width * 1.35), 1200)
  const scale = targetW / base.width
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const ctx = canvas.getContext('2d')
  // pdfjs tipa canvas DOM; @napi-rs/canvas es compatible en runtime.
  await page
    .render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    })
    .promise
  return canvas.toBuffer('image/png')
}

async function sendSlackWebhook(
  webhookUrl: string,
  text: string,
  blocks: Record<string, unknown>[],
  opts?: { unfurlLinks?: boolean; unfurlMedia?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = { text, blocks }
    if (opts?.unfurlLinks === false) payload.unfurl_links = false
    if (opts?.unfurlMedia === false) payload.unfurl_media = false

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text()
      console.warn('[slack-devoluciones] Error response:', body)
      return { ok: false, error: body.slice(0, 300) }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[slack-devoluciones] error:', msg)
    return { ok: false, error: msg }
  }
}

function formatFechaMx(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
