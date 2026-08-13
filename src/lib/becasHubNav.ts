import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'
import { urlBecasPanelApp } from '@/lib/dashboardModulosConfig'

export type BecasHubAccent = DashboardModuleAccent

export type BecasHubItem = {
  id: string
  label: string
  desc: string
  accent: BecasHubAccent
  /** Ruta interna Next */
  path?: string
  /** URL externa (becas-renovacion) */
  href?: string
  external?: boolean
  icon: 'refresh' | 'file-plus' | 'key' | 'scroll' | 'book'
}

function becasAdminBase(): string {
  const login = urlBecasPanelApp()
  // .../admin/login → .../admin
  return login.replace(/\/admin\/login\/?$/i, '/admin').replace(/\/$/, '')
}

const admin = () => becasAdminBase()

/** Hub Becas: 5 tarjetas (Control Escolar + Boletas secundaria). */
export const BECAS_HUB_NAV: BecasHubItem[] = [
  {
    id: 'renovaciones',
    label: 'Renovaciones',
    desc: 'Revisión de renovaciones de beca enviadas por familias.',
    accent: 'amber',
    href: `${admin()}/renovaciones`,
    external: true,
    icon: 'refresh',
  },
  {
    id: 'solicitudes',
    label: 'Solicitudes',
    desc: 'Solicitudes nuevas de beca y documentación.',
    accent: 'indigo',
    href: `${admin()}/solicitudes`,
    external: true,
    icon: 'file-plus',
  },
  {
    id: 'permisos',
    label: 'Permisos',
    desc: 'Autorizar acceso al portal de solicitud de beca.',
    accent: 'violet',
    href: `${admin()}/permisos`,
    external: true,
    icon: 'key',
  },
  {
    id: 'bitacora',
    label: 'Bitácora',
    desc: 'Auditoría de acciones del panel de Control Escolar.',
    accent: 'rose',
    href: `${admin()}/auditoria`,
    external: true,
    icon: 'scroll',
  },
  {
    id: 'boletas-secundaria',
    label: 'Boletas secundaria',
    desc: 'Captura, consulta, PDF y promedios (ciclos actuales y pasados).',
    accent: 'sky',
    path: '/boletas-secundaria',
    icon: 'book',
  },
]
