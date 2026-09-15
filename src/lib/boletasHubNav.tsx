import type { ReactNode } from 'react'
import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'

export type BoletasHubId =
  | 'kinder-espanol'
  | 'kinder-ingles'
  | 'primaria-espanol'
  | 'primaria-ingles'
  | 'secundaria'

export type BoletasHubItem = {
  id: BoletasHubId
  label: string
  desc: string
  accent: DashboardModuleAccent
  kicker: string
  tags: string[]
  /** Ruta al módulo (activo o placeholder). */
  path: string
  /** Si false, aún no hay captura en producción. */
  activo: boolean
  icon: ReactNode
}

const ICON_BOOK_ES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)

const ICON_BOOK_EN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h3" />
  </svg>
)

const ICON_SEC = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
)

export function boletasHubItems(): BoletasHubItem[] {
  return [
    {
      id: 'kinder-espanol',
      label: 'Kinder · Español',
      desc: 'Boleta en español del nivel Maternal / Kinder: captura, consulta y PDF.',
      accent: 'sky',
      kicker: 'Preescolar',
      tags: ['Español', 'Kinder'],
      path: '/boletas/kinder-espanol',
      activo: false,
      icon: ICON_BOOK_ES,
    },
    {
      id: 'kinder-ingles',
      label: 'Kinder · Inglés',
      desc: 'Boleta en inglés (English Preschool): captura, consulta y PDF.',
      accent: 'violet',
      kicker: 'Preescolar',
      tags: ['Inglés', 'Kinder'],
      path: '/boletas/kinder-ingles',
      activo: false,
      icon: ICON_BOOK_EN,
    },
    {
      id: 'primaria-espanol',
      label: 'Primaria · Español',
      desc: 'Boleta en español de primaria: grados, grupos, PDF y reportes.',
      accent: 'indigo',
      kicker: 'Primaria',
      tags: ['Español', 'Primaria'],
      path: '/boletas/primaria-espanol',
      activo: false,
      icon: ICON_BOOK_ES,
    },
    {
      id: 'primaria-ingles',
      label: 'Primaria · Inglés',
      desc: 'Boleta en inglés de primaria: captura docente y emisión de PDF.',
      accent: 'emerald',
      kicker: 'Primaria',
      tags: ['Inglés', 'Primaria'],
      path: '/boletas/primaria-ingles',
      activo: false,
      icon: ICON_BOOK_EN,
    },
    {
      id: 'secundaria',
      label: 'Secundaria',
      desc: 'Boleta única de secundaria: captura por materia, PDF, envío y ciclos históricos.',
      accent: 'rose',
      kicker: 'Secundaria',
      tags: ['Secundaria', 'PDF'],
      path: '/boletas-secundaria',
      activo: true,
      icon: ICON_SEC,
    },
  ]
}
