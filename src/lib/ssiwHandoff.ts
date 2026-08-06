import { createHmac, timingSafeEqual } from 'crypto'
import { urlSsiwApp } from '@/lib/dashboardModulosConfig'

export type SsiwHandoffRole = 'alumno' | 'maestra'

export type SsiwHandoffPayload = {
  role: SsiwHandoffRole
  displayName: string
  alumno_ref?: number
  alumno_id?: number
  usuario_id?: number
  usuario_username?: string
  exp: number
}

export { urlSsiwApp }

function getSecret(): string {
  const secret = process.env.SSIW_HANDOFF_SECRET?.trim()
  if (!secret) {
    throw new Error('SSIW_HANDOFF_SECRET no configurado')
  }
  return secret
}

export function signSsiwHandoff(
  payload: Omit<SsiwHandoffPayload, 'exp'>,
  ttlSec = 120
): string {
  const full: SsiwHandoffPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  }
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySsiwHandoff(token: string): SsiwHandoffPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null

  let secret: string
  try {
    secret = getSecret()
  } catch {
    return null
  }

  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SsiwHandoffPayload
    if (!raw || (raw.role !== 'alumno' && raw.role !== 'maestra')) return null
    if (!raw.displayName || typeof raw.exp !== 'number') return null
    if (raw.exp < Math.floor(Date.now() / 1000)) return null
    if (raw.role === 'alumno') {
      const ref = Number(raw.alumno_ref)
      const id = Number(raw.alumno_id)
      if (!Number.isFinite(ref) || ref <= 0 || !Number.isFinite(id) || id <= 0) return null
    }
    if (raw.role === 'maestra') {
      const uid = Number(raw.usuario_id)
      if (!Number.isFinite(uid) || uid <= 0) return null
    }
    return raw
  } catch {
    return null
  }
}
