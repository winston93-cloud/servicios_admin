import type { ReactNode } from 'react'
import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'
import { urlProrrogasAjustesApp } from '@/lib/prorrogasAjustesConfig'
import { urlCchicApp } from '@/lib/cchicConfig'
import {
  urlBecasAdminPath,
  urlBoletasApp,
  urlChequesApp,
  urlReportesConductaApp,
} from '@/lib/dashboardModulosConfig'

export type DashboardAdminNavItem = {
  label: string
  desc: string
  accent: DashboardModuleAccent
  icon: ReactNode
  path?: string
  href?: string
  kicker?: string
  badge?: string
  tags?: string[]
  featured?: boolean
}

const ICON_DESAYUNOS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10h16v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V10z" />
    <path d="M7 10V7.5a2.5 2.5 0 0 1 5 0V10" />
    <path d="M19 10h1a2 2 0 0 1 0 4h-1" />
    <path d="M8 3.5v2" />
    <path d="M12 2.5v2.5" />
    <path d="M16 3.5v2" />
  </svg>
)

export const NAV_ITEMS_ADMIN: DashboardAdminNavItem[] = [
  {
    label: 'Desayunos, Estancias y Comidas',
    desc: 'Cobros, pedidos y control de alimentación escolar en un solo flujo operativo.',
    path: '/pos',
    accent: 'amber',
    icon: ICON_DESAYUNOS,
    kicker: 'Punto de venta',
    badge: 'Módulo principal',
    tags: ['POS', 'Estancias', 'Comidas'],
    featured: true,
  },
  {
    label: 'Servicios',
    desc: 'Alumnos, pagos, becas y herramientas administrativas del ciclo escolar.',
    path: '/servicios',
    accent: 'indigo',
    kicker: 'Administración',
    tags: ['Alumnos', 'Pagos', 'Becas'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    label: 'Reportes',
    desc: 'Consulta y generación de reportes administrativos por ciclo y área.',
    path: '/reportes',
    accent: 'violet',
    kicker: 'Análisis',
    tags: ['PDF', 'Consultas', 'Exportar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Prórrogas y Ajustes',
    desc: 'Gestión de prórrogas y ajustes de pago escolar.',
    href: urlProrrogasAjustesApp(),
    accent: 'rose',
    kicker: 'Pagos',
    tags: ['Prórrogas', 'Ajustes'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="16" r="3" />
        <polyline points="12 14 12 16 13.5 17.5" />
      </svg>
    ),
  },
  {
    label: 'Agenda psicólogas',
    desc: 'Calendario y citas del área de psicología.',
    href: 'https://agendaw.vercel.app/admin/',
    accent: 'sky',
    kicker: 'Psicología',
    tags: ['Citas', 'Calendario'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M12 14v4" />
        <path d="M10 16h4" />
      </svg>
    ),
  },
  {
    label: 'Agenda directoras',
    desc: 'Panel de agenda para dirección escolar.',
    href: 'https://agendaw.vercel.app/admin/dashboard',
    accent: 'violet',
    kicker: 'Dirección',
    tags: ['Agenda', 'Coordinación'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M7 14h4" />
        <path d="M7 18h7" />
        <path d="M14 14h3" />
      </svg>
    ),
  },
  {
    label: 'Open House/Sesiones Inf. Admin',
    desc: 'Inscripciones y gestión de Open House y sesiones informativas.',
    href: 'https://open-house-chi.vercel.app/admin',
    accent: 'emerald',
    kicker: 'Admisiones',
    tags: ['Open House', 'Inscripciones'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
        <path d="M12 7v3" />
        <path d="M10.5 9.5h3" />
      </svg>
    ),
  },
  {
    label: 'Monitoreo y Control',
    desc: 'Caja chica, egresos, fondos y reportes de control.',
    href: urlCchicApp(),
    accent: 'indigo',
    kicker: 'Finanzas',
    tags: ['Caja chica', 'Egresos'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
        <rect x="3" y="2" width="18" height="4" rx="1" />
        <path d="M7 6v2" />
        <path d="M12 6v2" />
        <path d="M17 6v2" />
      </svg>
    ),
  },
  {
    label: 'Facturación CFDI',
    desc: 'Timbrado, cancelaciones y devoluciones fiscales.',
    path: '/facturacion',
    accent: 'emerald',
    kicker: 'Fiscal',
    tags: ['Timbrado', 'CFDI', 'Cancelación'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v20l-4-2-4 2-4-2-4 2V2z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    ),
  },
  {
    label: 'Cheques',
    desc: 'Emisión, impresión y control de cheques escolares.',
    href: urlChequesApp(),
    accent: 'sky',
    kicker: 'Tesorería',
    tags: ['Cheques', 'Impresión'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <line x1="6" y1="10" x2="18" y2="10" />
        <line x1="6" y1="14" x2="12" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Boletas',
    desc: 'Captura, consulta y envío de boletas escolares.',
    href: urlBoletasApp(),
    accent: 'indigo',
    kicker: 'Control escolar',
    tags: ['Boletas', 'Calificaciones'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="8" y1="15" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    label: 'Becas',
    desc: 'Asignación y seguimiento de becas por alumno y ciclo.',
    path: urlBecasAdminPath(),
    accent: 'amber',
    kicker: 'Becas',
    tags: ['Asignación', 'Ciclo'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: 'Reportes de Conducta',
    desc: 'Captura y seguimiento de reportes de conducta escolar.',
    href: urlReportesConductaApp(),
    accent: 'rose',
    kicker: 'Conducta',
    tags: ['Reportes', 'Seguimiento'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
]

export function navItemKey(item: Pick<DashboardAdminNavItem, 'label' | 'path' | 'href'>): string {
  return item.path ?? item.href ?? item.label
}

export function abrirNavItem(
  item: Pick<DashboardAdminNavItem, 'path' | 'href'>,
  push: (path: string) => void
) {
  if (item.href) {
    window.open(item.href, '_blank', 'noopener,noreferrer')
    return
  }
  if (item.path) push(item.path)
}
