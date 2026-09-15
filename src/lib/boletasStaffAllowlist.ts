/**
 * Cuentas institucionales con acceso Google a boletas
 * (equivalente a dirección/admin en todos los niveles ES e EN).
 */
export type BoletasDirectoraGoogle = {
  email: string
  nombre: string
  /** Prefijo de sesión (usuario sintético). */
  usuario: string
  /** ID estable de sesión admin (no colisiona con maestros reales). */
  id: number
}

export const BOLETAS_DIRECTORAS_GOOGLE: BoletasDirectoraGoogle[] = [
  {
    email: 'dg@winston93.edu.mx',
    nombre: 'Dirección General',
    usuario: 'dg',
    id: 900001,
  },
  {
    email: 'sistemas.desarrollo@winston93.edu.mx',
    nombre: 'Sistemas Desarrollo',
    usuario: 'sistemas.desarrollo',
    id: 900002,
  },
]

export function boletasDirectoraPorEmail(emailRaw: string): BoletasDirectoraGoogle | null {
  const email = emailRaw.trim().toLowerCase()
  return BOLETAS_DIRECTORAS_GOOGLE.find((d) => d.email === email) ?? null
}
