export type BecarioPerfil = {
  username: string
  nombre: string
  /** Iniciales para avatar */
  iniciales: string
  accent: 'sky' | 'violet'
}

/** Becarios activos del programa (login por nombre). */
export const BECARIOS: BecarioPerfil[] = [
  { username: 'kevin', nombre: 'Kevin', iniciales: 'KE', accent: 'sky' },
  { username: 'omar', nombre: 'Omar', iniciales: 'OM', accent: 'violet' },
]

export function becarioPorUsername(username: string): BecarioPerfil | null {
  const u = username.trim().toLowerCase()
  return BECARIOS.find((b) => b.username === u) ?? null
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
