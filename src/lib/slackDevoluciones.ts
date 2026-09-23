/**
 * Aviso a #avisos_devolucion al registrar una devolución de pago con tarjeta.
 * Misma idea que AgendaW (webhook Incoming); aquí además se adjunta la URL pública del screenshot.
 * Env: SLACK_WEBHOOK_SISTEMASWINSTON (URL del Incoming Webhook del canal).
 */
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

  const fecha = formatFechaMx(data.createdAt)
  const asuntoTxt = data.asunto.trim() || '(sin asunto)'
  const links = data.adjuntos
    .filter((a) => a.url)
    .map((a) => `• <${a.url}|${a.nombre || 'archivo'}>`)
    .join('\n')

  const text = [
    `🧾 *Devolución lista para administración (etapa 2/5)*`,
    ``,
    `*Folio:* #${data.id}`,
    `*Asunto:* ${asuntoTxt}`,
    `*Capturó:* ${data.realizadoPor}`,
    `*Fecha captura:* ${fecha}`,
    `*Envió Sistemas:* ${data.enviadoPor}`,
    ``,
    `*Archivos (${data.adjuntos.length}):*`,
    links || '—',
  ].join('\n')

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ]

  if (data.screenshotUrl) {
    blocks.push({
      type: 'image',
      image_url: data.screenshotUrl,
      alt_text: `Screenshot autorización — folio #${data.id}`,
    })
  }

  let imgs = 0
  for (const a of data.adjuntos) {
    if (imgs >= 3) break
    if (!a.url || !String(a.mime || '').startsWith('image/')) continue
    blocks.push({
      type: 'image',
      image_url: a.url,
      alt_text: a.nombre || 'Adjunto',
    })
    imgs += 1
  }

  return sendSlackWebhook(webhookUrl, text, blocks)
}

async function sendSlackWebhook(
  webhookUrl: string,
  text: string,
  blocks: Record<string, unknown>[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
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
