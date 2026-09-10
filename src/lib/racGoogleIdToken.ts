import { OAuth2Client } from 'google-auth-library'

const DOMINIO_INSTITUCIONAL = 'winston93.edu.mx'

export class RacGoogleAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

function clientId(): string {
  const id =
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    ''
  if (!id) {
    throw new RacGoogleAuthError(
      'Google Auth no está configurado (falta NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID).',
      503
    )
  }
  return id
}

export function googleOAuthClientIdPublico(): string | null {
  const id = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim()
  return id || null
}

function assertEmailInstitucional(emailRaw: string, emailVerified: boolean): string {
  const email = String(emailRaw ?? '')
    .trim()
    .toLowerCase()
  if (!email || !emailVerified) {
    throw new RacGoogleAuthError('El correo de Google no está verificado.')
  }
  const dominio = email.split('@')[1] ?? ''
  if (dominio !== DOMINIO_INSTITUCIONAL) {
    throw new RacGoogleAuthError(`Solo se permiten cuentas @${DOMINIO_INSTITUCIONAL}.`)
  }
  return email
}

/** Verifica id_token de Google Identity Services. */
export async function verificarIdTokenGoogle(idToken: string): Promise<{ email: string }> {
  const token = String(idToken ?? '').trim()
  if (!token) throw new RacGoogleAuthError('Falta el token de Google.')

  const aud = clientId()
  const client = new OAuth2Client(aud)
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: aud })
    payload = ticket.getPayload()
  } catch {
    throw new RacGoogleAuthError('No se pudo verificar la sesión de Google.')
  }

  return {
    email: assertEmailInstitucional(
      String(payload?.email ?? ''),
      payload?.email_verified === true
    ),
  }
}

/**
 * Verifica access_token (flujo con prompt=select_account: siempre pide cuenta).
 * Confirma aud del token y correo vía userinfo.
 */
export async function verificarAccessTokenGoogle(
  accessToken: string
): Promise<{ email: string }> {
  const token = String(accessToken ?? '').trim()
  if (!token) throw new RacGoogleAuthError('Falta el token de Google.')

  const audEsperado = clientId()
  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
  )
  if (!infoRes.ok) {
    throw new RacGoogleAuthError('No se pudo verificar la sesión de Google.')
  }
  const info = (await infoRes.json()) as { aud?: string; error?: string }
  if (info.error || String(info.aud ?? '') !== audEsperado) {
    throw new RacGoogleAuthError('Token de Google no válido para esta aplicación.')
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!userRes.ok) {
    throw new RacGoogleAuthError('No se pudo leer el correo de Google.')
  }
  const user = (await userRes.json()) as {
    email?: string
    email_verified?: boolean | string
  }
  const verified = user.email_verified === true || user.email_verified === 'true'
  return { email: assertEmailInstitucional(String(user.email ?? ''), verified) }
}

/** Acepta id_token (botón GIS) o access_token (selector de cuenta forzado). */
export async function verificarCredencialGoogle(input: {
  idToken?: string
  accessToken?: string
}): Promise<{ email: string }> {
  const idToken = String(input.idToken ?? '').trim()
  const accessToken = String(input.accessToken ?? '').trim()
  if (accessToken) return verificarAccessTokenGoogle(accessToken)
  if (idToken) return verificarIdTokenGoogle(idToken)
  throw new RacGoogleAuthError('Falta el token de Google.')
}
