import type { ReactNode } from 'react'
import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'
import { urlProrrogasAjustesApp } from '@/lib/prorrogasAjustesConfig'
import { urlCchicApp } from '@/lib/cchicConfig'
import { urlChequesApp, urlContratosApp } from '@/lib/dashboardModulosConfig'

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
    tags: ['POS', 'Estancias', 'Comidas'],
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
    label: 'Prórrogas',
    desc: 'Registro y seguimiento de prórrogas de pago escolar.',
    href: urlProrrogasAjustesApp(),
    accent: 'rose',
    kicker: 'Pagos',
    tags: ['Prórrogas'],
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
    label: 'Bajas administrativas',
    desc: 'Baja general de alumnos y aviso por correo al equipo institucional.',
    path: '/bajas-administrativas',
    accent: 'rose',
    kicker: 'Alumnos',
    tags: ['Bajas', 'Estatus'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="17" y1="8" x2="22" y2="13" />
        <line x1="22" y1="8" x2="17" y2="13" />
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
    label: 'Control Escolar',
    desc: 'Autoriza documentación completa de nuevo ingreso y habilita el recibo final.',
    path: '/control-escolar',
    accent: 'sky',
    kicker: 'Inscripciones',
    tags: ['Documentos', 'Recibo final'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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
    desc: 'Emisión, impresión y control de cheques (Winston, Educativo y Sociedades de Padres).',
    href: urlChequesApp(),
    accent: 'sky',
    kicker: 'Tesorería',
    tags: ['Cheques', 'Pólizas', 'InsForge'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <line x1="6" y1="10" x2="18" y2="10" />
        <line x1="6" y1="14" x2="12" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Contratos',
    desc: 'Generación y gestión de contratos laborales (determinado, indeterminado y por hora).',
    href: urlContratosApp(),
    accent: 'violet',
    kicker: 'RRHH',
    tags: ['Contratos', 'PDF', 'DOCX'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="10" y1="9" x2="12" y2="9" />
      </svg>
    ),
  },
  {
    label: 'Boletas',
    desc: 'Captura, consulta, PDF y promedios de secundaria (ciclos actuales y pasados).',
    path: '/boletas-secundaria',
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
    desc: 'Renovaciones, solicitudes, permisos, bitácora y boletas de secundaria.',
    path: '/becas',
    accent: 'amber',
    kicker: 'Becas',
    tags: ['Revisión', 'Boletas', 'Control Escolar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: 'Reportes académicos y de conducta',
    desc: 'Captura y seguimiento de reportes académicos y de conducta escolar.',
    path: '/reportes-conducta',
    accent: 'rose',
    kicker: 'Académico',
    tags: ['Académico', 'Conducta'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Entregas a Pie',
    desc: 'Entrega de alumnos con salida a pie registrada para el día.',
    path: '/ssiw/entrar?ambiente=entregas',
    accent: 'emerald',
    kicker: 'Salida institucional',
    tags: ['Entregas', 'A pie'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11l-3-3-3 3" />
        <path d="M19 8v8" />
      </svg>
    ),
  },
  // 2026-08-21 - Prototipo firma electrónica (canvas + pdf-lib) para personal usuario.
  {
    label: 'Pruebas firma electrónica',
    desc: 'Sandbox: documento de prueba, pad de firma y PDF firmado en el navegador.',
    path: '/firma-electronica?sandbox=1',
    accent: 'sky',
    kicker: 'Pruebas',
    tags: ['Firma', 'Electrónica'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="M15 5l4 4" />
        <path d="M3 17c2.5-1 4.5 0 6 1.5S12 21 15 20" />
      </svg>
    ),
  },
]

export function navItemKey(item: Pick<DashboardAdminNavItem, 'label' | 'path' | 'href'>): string {
  return item.path ?? item.href ?? item.label
}

export function abrirNavItem(
  item: Pick<DashboardAdminNavItem, 'path' | 'href'>,
  push: (path: string) => void,
  opts?: { usuario?: string | null; operador?: string | null }
) {
  if (item.href) {
    let href = item.href
    const user = (opts?.usuario ?? opts?.operador ?? '').trim()
    // Prórrogas identifica al autor con ?usuario= del dashboard.
    if (user && /prorrogas/i.test(href)) {
      href = urlProrrogasAjustesApp(user)
    }
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  if (item.path) push(item.path)
}
