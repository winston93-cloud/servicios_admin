import type { ReactNode } from 'react'
import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'

export type ReportesConductaHubItem = {
  id: 'kinder' | 'primaria' | 'secundaria'
  label: string
  desc: string
  accent: DashboardModuleAccent
  kicker: string
  tags: string[]
  icon: ReactNode
}

const ICON_KINDER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 19.5c.6-3.2 3.3-5.5 6.5-5.5s5.9 2.3 6.5 5.5" />
    <path d="M16.5 7.2c.9-.4 1.8-.4 2.6.1" />
  </svg>
)

const ICON_PRIMARIA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19V7l8-4 8 4v12" />
    <path d="M9 19v-6h6v6" />
    <path d="M4 19h16" />
  </svg>
)

const ICON_SECUNDARIA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export function reportesConductaHubItems(): ReportesConductaHubItem[] {
  return [
    {
      id: 'kinder',
      label: 'Kinder',
      desc: 'Reportes de conducta del nivel preescolar.',
      accent: 'sky',
      kicker: 'Kinder',
      tags: ['Reportes', 'Seguimiento'],
      icon: ICON_KINDER,
    },
    {
      id: 'primaria',
      label: 'Primaria',
      desc: 'Reportes de conducta del nivel primaria.',
      accent: 'indigo',
      kicker: 'Primaria',
      tags: ['Reportes', 'Seguimiento'],
      icon: ICON_PRIMARIA,
    },
    {
      id: 'secundaria',
      label: 'Secundaria',
      desc: 'Reportes académicos y de conducta del nivel secundaria.',
      accent: 'rose',
      kicker: 'Secundaria',
      tags: ['Académico', 'Conducta'],
      icon: ICON_SECUNDARIA,
    },
  ]
}
