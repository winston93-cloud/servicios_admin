/**
 * Proxy Payworks (payw2) en InsForge — sobresvive al apagón del hosting winston93.
 * Deploy:
 *   npx @insforge/cli functions deploy banorte-payw2 --file ./functions/banorte-payw2.ts \\
 *     --name "Banorte Payworks proxy" --description "POST form-urlencoded a payw2 (IP InsForge)"
 *
 * Auth: header X-Banorte-Proxy-Key (mismo que BANORTE_PAYW2_PROXY_KEY / secreto del proyecto).
 */
const PROXY_KEY_DEFAULT = 'WinstonBanortePayw2Proxy-2026-v1'
const PAYW2_URL = 'https://via.pagosbanorte.com/payw2'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Banorte-Proxy-Key, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)
  }

  const expected =
    Deno.env.get('BANORTE_PAYW2_PROXY_KEY')?.trim() || PROXY_KEY_DEFAULT
  const provided = (req.headers.get('X-Banorte-Proxy-Key') || '').trim()
  if (!provided || provided !== expected) {
    return json({ ok: false, error: 'FORBIDDEN' }, 403)
  }

  const body = await req.text()
  if (!body) {
    return json({ ok: false, error: 'EMPTY_BODY' }, 400)
  }

  let upstream: Response
  try {
    upstream = await fetch(PAYW2_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '*/*',
      },
      body,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return json({ ok: false, error: 'FETCH_ERROR', message }, 502)
  }

  const headers: Record<string, string> = {}
  upstream.headers.forEach((value, key) => {
    headers[key.toUpperCase()] = value
  })
  const responseBody = await upstream.text()

  return json({
    ok: true,
    http_code: upstream.status,
    headers,
    body: responseBody,
    via: 'insforge',
  })
}
