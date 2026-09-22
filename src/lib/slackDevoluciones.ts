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
    blocks.push({
      type: 'image',
      image_url: data.imageUrl,
      alt_text: `Autorización Slack — devolución #${data.id}`,
    })
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<${data.imageUrl}|Ver screenshot de autorización>`,
        },
      ],
    })
  }

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
