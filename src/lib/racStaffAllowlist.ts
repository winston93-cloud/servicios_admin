/**
 * Staff oficial RAC por correo institucional (Google + login password).
 * Maestros NO van aquí: se resuelven por boleta_maestro.maestro_email + nivel.
 */

export type RacStaffPanel = 'maternal-kinder' | 'primaria' | 'secundaria'

export type RacStaffAllowEntry = {
  email: string
  /** Rol de sesión RAC (secundaria o nivel). */
  role: 'direccion' | 'psicologia' | 'prefectura'
  perfil: 4 | 5 | 6
  etiqueta: string
}

const DOMINIO = '@winston93.edu.mx'

function e(local: string): string {
  return `${local}${DOMINIO}`.toLowerCase()
}

/** Tabla oficial confirmada con Mario (2026-09). */
export const RAC_STAFF_ALLOWLIST: Record<RacStaffPanel, readonly RacStaffAllowEntry[]> = {
  'maternal-kinder': [
    {
      email: e('direccion.kinder'),
      role: 'direccion',
      perfil: 6,
      etiqueta: 'Dirección español',
    },
    {
      email: e('englishcoord.educativo'),
      role: 'direccion',
      perfil: 6,
      etiqueta: 'Dirección inglés',
    },
    {
      email: e('psicologia.kinder'),
      role: 'psicologia',
      perfil: 4,
      etiqueta: 'Psicología',
    },
  ],
  primaria: [
    {
      email: e('direccion.primaria'),
      role: 'direccion',
      perfil: 6,
      etiqueta: 'Dirección español',
    },
    {
      email: e('coordinacioninglesprimaria'),
      role: 'direccion',
      perfil: 6,
      etiqueta: 'Dirección inglés',
    },
    {
      email: e('psicologia.primaria'),
      role: 'psicologia',
      perfil: 4,
      etiqueta: 'Psicología',
    },
  ],
  secundaria: [
    {
      email: e('direccion.secundaria'),
      role: 'direccion',
      perfil: 6,
      etiqueta: 'Dirección',
    },
    {
      email: e('psicologia.secundaria'),
      role: 'psicologia',
      perfil: 4,
      etiqueta: 'Psicología',
    },
    {
      email: e('prefectura.secundaria'),
      role: 'prefectura',
      perfil: 5,
      etiqueta: 'Prefectura',
    },
    {
      email: e('asistente.secundaria'),
      role: 'prefectura',
      perfil: 5,
      etiqueta: 'Asistente de dirección',
    },
  ],
} as const

export function normRacEmail(s: string | null | undefined): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

export function staffAllowEntryParaPanel(
  panel: RacStaffPanel,
  emailRaw: string | null | undefined
): RacStaffAllowEntry | null {
  const email = normRacEmail(emailRaw)
  if (!email) return null
  return RAC_STAFF_ALLOWLIST[panel].find((x) => x.email === email) ?? null
}

export function staffEmailsDelPanel(panel: RacStaffPanel): string[] {
  return RAC_STAFF_ALLOWLIST[panel].map((x) => x.email)
}
