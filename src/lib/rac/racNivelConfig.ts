import type { NivelEscolarValor } from '@/lib/nivelEscolar'

export type RacNivelSlug = 'primaria' | 'maternal-kinder'

export type RacRolNivel =
  | 'maestro'
  | 'coordinacion'
  | 'psicologia'
  | 'control_escolar'
  | 'direccion'

export type RacGradoRac = {
  nivelEscolar: NivelEscolarValor
  grado: number
}

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
  /** Grupos visibles en captura (preescolar suele ser solo A). */
  gruposCaptura: readonly string[]
  /** Si no hay materias ni alumnos, estos grados se aseguran en catálogo. */
  gradosFallback: RacGradoRac[]
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
  gruposCaptura: ['A', 'B', 'C'],
  gradosFallback: [
    { nivelEscolar: 3, grado: 1 },
    { nivelEscolar: 3, grado: 2 },
    { nivelEscolar: 3, grado: 3 },
    { nivelEscolar: 3, grado: 4 },
    { nivelEscolar: 3, grado: 5 },
    { nivelEscolar: 3, grado: 6 },
  ],
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
  gruposCaptura: ['A'],
  gradosFallback: [
    { nivelEscolar: 1, grado: 1 },
    { nivelEscolar: 2, grado: 1 },
    { nivelEscolar: 2, grado: 2 },
    { nivelEscolar: 2, grado: 3 },
  ],
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
