import type { NivelEscolarValor } from '@/lib/nivelEscolar'

export type RacNivelSlug = 'primaria' | 'maternal-kinder'

export type RacRolNivel =
  | 'maestro'
  | 'coordinacion'
  | 'psicologia'
  | 'control_escolar'
  | 'direccion'

export type RacNivelConfig = {
  slug: RacNivelSlug
  titulo: string
  subtitulo: string
  kicker: string
  nivelesEscolares: NivelEscolarValor[]
  /** Maestro elige materia (secundaria) vs grado+grupo fijo. */
  modoGradoGrupo: boolean
  cookieAuth: string
  apiBase: string
  rutaApp: string
  rolOperaciones: 'prefectura' | 'control_escolar'
  etiquetaOperaciones: string
}

export const RAC_PRIMARIA: RacNivelConfig = {
  slug: 'primaria',
  titulo: 'Primaria',
  subtitulo: 'Reportes académicos y de conducta',
  kicker: 'Instituto Winston Churchill · Primaria',
  nivelesEscolares: [3],
  modoGradoGrupo: true,
  cookieAuth: 'rac_primaria_auth',
  apiBase: '/api/rac-nivel/primaria',
  rutaApp: '/reportes-conducta/primaria',
  rolOperaciones: 'control_escolar',
  etiquetaOperaciones: 'Control escolar',
}

export const RAC_MATERNAL_KINDER: RacNivelConfig = {
  slug: 'maternal-kinder',
  titulo: 'Maternal / Kinder',
  subtitulo: 'Reportes académicos y de conducta',
  kicker: 'Instituto Winston Churchill · Preescolar',
  nivelesEscolares: [1, 2],
  modoGradoGrupo: true,
  cookieAuth: 'rac_maternal_kinder_auth',
  apiBase: '/api/rac-nivel/maternal-kinder',
  rutaApp: '/reportes-conducta/maternal-kinder',
  rolOperaciones: 'control_escolar',
  etiquetaOperaciones: 'Control escolar',
}

const MAP: Record<RacNivelSlug, RacNivelConfig> = {
  primaria: RAC_PRIMARIA,
  'maternal-kinder': RAC_MATERNAL_KINDER,
}

export function racConfigDeSlug(slug: string): RacNivelConfig | null {
  if (slug === 'primaria' || slug === 'maternal-kinder') return MAP[slug]
  return null
}

export function esRacNivelSlug(v: string): v is RacNivelSlug {
  return v === 'primaria' || v === 'maternal-kinder'
}
