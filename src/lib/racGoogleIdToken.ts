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

/** Verifica id_token de Google Identity Services y exige correo @winston93.edu.mx verificado. */
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

  const email = String(payload?.email ?? '')
    .trim()
    .toLowerCase()
  if (!email || payload?.email_verified !== true) {
    throw new RacGoogleAuthError('El correo de Google no está verificado.')
  }

  const dominio = email.split('@')[1] ?? ''
  if (dominio !== DOMINIO_INSTITUCIONAL) {
    throw new RacGoogleAuthError(`Solo se permiten cuentas @${DOMINIO_INSTITUCIONAL}.`)
  }

  return { email }
}
