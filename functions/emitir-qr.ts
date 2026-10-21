/**
 * Emite el código QR de acceso de un alumno.
 * Solo invocación server-side (API key). El browser del portal no llama esto.
 *
 * Formato: A.{alumno_ref}.{firma12}
 * firma12 = HMAC-SHA256(A.{ref}) en base64url, 12 chars.
 * Secret: QR_TOKEN_SECRET (mismo que control-acceso).
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function firmarCodigo(ref: number, secret: string): Promise<string> {
  const base = `A.${Number(ref)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base))
  const firma = bytesToBase64Url(new Uint8Array(sig)).slice(0, 12)
  return `${base}.${firma}`
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function tokenDeRequest(req: Request): string {
  const auth = req.headers.get('Authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return (
    req.headers.get('x-api-key') ||
    req.headers.get('apikey') ||
    ''
  ).trim()
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Método no permitido.' })
  }

  const apiKey = (Deno.env.get('API_KEY') || '').trim()
  const presented = tokenDeRequest(req)
  if (!apiKey || !presented || presented !== apiKey) {
    return json(401, { error: 'No autorizado.' })
  }

  const secret = (Deno.env.get('QR_TOKEN_SECRET') || '').trim()
  if (!secret) {
    return json(500, { error: 'Falta QR_TOKEN_SECRET.' })
  }

  let body: { alumnoRef?: unknown } = {}
  try {
    body = (await req.json()) as { alumnoRef?: unknown }
  } catch {
    return json(400, { error: 'JSON inválido.' })
  }

  const alumnoRef = Number(body.alumnoRef)
  if (!Number.isFinite(alumnoRef) || alumnoRef <= 0 || !Number.isInteger(alumnoRef)) {
    return json(400, { error: 'alumnoRef inválido.' })
  }

  const codigo = await firmarCodigo(alumnoRef, secret)
  return json(200, { codigo, alumnoRef })
}
