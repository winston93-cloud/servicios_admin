/**
 * Audiencia del News mensual por plantel/nivel.
 * Desayunos: audiencia vacía (único menú para todos).
 */

export type AudienciaNews = 'educativo' | 'primaria' | 'secundaria'

export const AUDIENCIAS_NEWS: readonly {
  valor: AudienciaNews
  titulo: string
  descripcion: string
}[] = [
  {
    valor: 'educativo',
    titulo: 'News Educativo',
    descripcion: 'Maternal y Kinder (plantel Educativo).',
  },
  {
    valor: 'primaria',
    titulo: 'News Primaria',
    descripcion: 'Primaria (plantel Winston).',
  },
  {
    valor: 'secundaria',
    titulo: 'News Secundaria',
    descripcion: 'Secundaria (plantel Winston).',
  },
] as const

export const AUDIENCIA_DESAYUNOS = '' as const

export function etiquetaAudienciaNews(audiencia: AudienciaNews): string {
  return AUDIENCIAS_NEWS.find((a) => a.valor === audiencia)?.titulo ?? audiencia
}

/** 1–2 Educativo; 3 Primaria; 4 Secundaria. */
export function audienciaNewsDesdeNivel(nivel: number | null | undefined): AudienciaNews | null {
  const n = Number(nivel)
  if (n === 1 || n === 2) return 'educativo'
  if (n === 3) return 'primaria'
  if (n === 4) return 'secundaria'
  return null
}

export function parseAudienciaNews(raw: string | null | undefined): AudienciaNews | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'educativo' || v === 'primaria' || v === 'secundaria') return v
  return null
}
