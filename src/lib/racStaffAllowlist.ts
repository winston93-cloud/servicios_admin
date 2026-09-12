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

const SISTEMAS_DESARROLLO = e('sistemas.desarrollo')

/** Roles de prueba para Sistemas (QA / bugs reportados). */
function rolesTesterQa(panel: RacStaffPanel): RacStaffAllowEntry[] {
  const base: RacStaffAllowEntry[] = [
    {
      email: SISTEMAS_DESARROLLO,
      role: 'psicologia',
      perfil: 4,
      etiqueta: 'Psicología (QA)',
    },
    {
      email: SISTEMAS_DESARROLLO,
      role: 'direccion',
      perfil: 6,
      etiqueta: 'Directora (QA)',
    },
  ]
  if (panel === 'secundaria') {
    base.push({
      email: SISTEMAS_DESARROLLO,
      role: 'prefectura',
      perfil: 5,
      etiqueta: 'Asistente (QA)',
    })
  }
  return base
}

/** Tabla oficial confirmada con Mario (2026-09) + tester Sistemas. */
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
    ...rolesTesterQa('maternal-kinder'),
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
    ...rolesTesterQa('primaria'),
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
    ...rolesTesterQa('secundaria'),
  ],
}

export function normRacEmail(s: string | null | undefined): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

/** Primera coincidencia (login password sin selector). */
export function staffAllowEntryParaPanel(
  panel: RacStaffPanel,
  emailRaw: string | null | undefined
): RacStaffAllowEntry | null {
  const entries = staffAllowEntriesParaPanel(panel, emailRaw)
  return entries[0] ?? null
}

/** Todas las coincidencias (Google: selector si hay más de una). */
export function staffAllowEntriesParaPanel(
  panel: RacStaffPanel,
  emailRaw: string | null | undefined
): RacStaffAllowEntry[] {
  const email = normRacEmail(emailRaw)
  if (!email) return []
  return RAC_STAFF_ALLOWLIST[panel].filter((x) => x.email === email)
}

export function staffEmailsDelPanel(panel: RacStaffPanel): string[] {
  return [...new Set(RAC_STAFF_ALLOWLIST[panel].map((x) => x.email))]
}

/**
 * Correos de dirección (oficiales) según nivel escolar del alumno.
 * Excluye el tester QA (sistemas.desarrollo).
 * 1–2 maternal/kinder · 3 primaria · 4 secundaria.
 */
export function correosDireccionPorNivelEscolar(nivel: number): string[] {
  const n = Number(nivel)
  let panel: RacStaffPanel | null = null
  if (n === 1 || n === 2) panel = 'maternal-kinder'
  else if (n === 3) panel = 'primaria'
  else if (n === 4) panel = 'secundaria'
  if (!panel) return []

  return [
    ...new Set(
      RAC_STAFF_ALLOWLIST[panel]
        .filter((x) => x.role === 'direccion' && x.email !== SISTEMAS_DESARROLLO)
        .map((x) => x.email)
    ),
  ]
}

export const RAC_QA_TESTER_EMAIL = SISTEMAS_DESARROLLO
