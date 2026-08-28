import type { FacturacionAccent } from './facturacionNav'

export type FacturacionSatNavItem = {
  id: string
  label: string
  desc: string
  path: string
  accent: FacturacionAccent
  icon: string
}

export const FACTURACION_SAT_NAV: FacturacionSatNavItem[] = [
  {
    id: 'descarga-masiva',
    label: 'Descarga masiva',
    desc: 'CFDI recibidos del SAT → Excel con e.firma (paquetes en InsForge)',
    path: '/facturacion/sat/descarga-masiva',
    accent: 'sky',
    icon: 'download',
  },
  {
    id: 'conciliacion',
    label: 'Conciliación',
    desc: 'Conciliación de comprobantes y movimientos fiscales',
    path: '/facturacion/sat/conciliacion',
    accent: 'emerald',
    icon: 'scale',
  },
]

export function facturacionSatItemPorPath(pathname: string): FacturacionSatNavItem | undefined {
  return FACTURACION_SAT_NAV.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  )
}
