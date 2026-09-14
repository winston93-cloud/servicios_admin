export type BecarioPerfil = {
  username: string
  nombre: string
  /** Iniciales para avatar */
  iniciales: string
  accent: 'sky' | 'violet'
}

export type BecarioRevisorGoogle = {
  email: string
  nombre: string
  /** Prefijo de sesión (username sintético) */
  username: string
}

/** Becarios activos del programa (login por nombre + clave). */
export const BECARIOS: BecarioPerfil[] = [
  { username: 'kevin', nombre: 'Kevin', iniciales: 'KE', accent: 'sky' },
  { username: 'omar', nombre: 'Omar', iniciales: 'OM', accent: 'violet' },
]

/**
 * Cuentas institucionales con acceso de revisión (historial + reportes).
 * Solo estas pueden entrar con Google al módulo de bitácora.
 */
export const BECARIOS_REVISORES_GOOGLE: BecarioRevisorGoogle[] = [
  {
    email: 'sistemas.desarrollo@winston93.edu.mx',
    nombre: 'Sistemas Desarrollo',
    username: 'revisor-sistemas',
  },
  {
    email: 'dg@winston93.edu.mx',
    nombre: 'Dirección General',
    username: 'revisor-dg',
  },
]

export function becarioPorUsername(username: string): BecarioPerfil | null {
  const u = username.trim().toLowerCase()
  return BECARIOS.find((b) => b.username === u) ?? null
}

export function revisorPorEmail(emailRaw: string): BecarioRevisorGoogle | null {
  const email = emailRaw.trim().toLowerCase()
  return BECARIOS_REVISORES_GOOGLE.find((r) => r.email === email) ?? null
}

/** Contraseña por becario: env BECARIOS_<USER>_PASSWORD o default de arranque. */
export function passwordBecario(username: string): string {
  const key = `BECARIOS_${username.trim().toUpperCase()}_PASSWORD`
  const fromEnv = process.env[key]?.trim()
  if (fromEnv) return fromEnv
  if (username === 'kevin') return 'Kevin2026!'
  if (username === 'omar') return 'Omar2026!'
  return ''
}
