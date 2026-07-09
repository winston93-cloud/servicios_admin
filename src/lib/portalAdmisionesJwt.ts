import { createHmac } from 'crypto'
import {
  jwtDocumentosIssuer,
  jwtDocumentosSecret,
  jwtDocumentosTtlSec,
  portalDocumentosBaseUrl,
} from './portalAdmisionesConfig'

function base64url(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  return buf.toString('base64url')
}

function firmarJwtHs256(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

/** Enlace firmado al portal de documentos (port de admisiones/module/jwt.php). */
export function generarUrlPortalDocumentos(alumnoRef: number | string): string | null {
  const secret = jwtDocumentosSecret()
  if (!secret) return null

  const now = Math.floor(Date.now() / 1000)
  const token = firmarJwtHs256(
    {
      sub: String(alumnoRef),
      iss: jwtDocumentosIssuer(),
      iat: now,
      exp: now + jwtDocumentosTtlSec(),
    },
    secret
  )

  return `${portalDocumentosBaseUrl()}?t=${encodeURIComponent(token)}`
}
