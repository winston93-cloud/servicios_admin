export type FacturacionAccent = 'amber' | 'indigo' | 'violet' | 'rose' | 'emerald' | 'sky'

export type FacturacionNavItem = {
  id: string
  label: string
  desc: string
  path: string
  accent: FacturacionAccent
  fase: number
  icon: string
}

export const FACTURACION_NAV: FacturacionNavItem[] = [
  {
    id: 'mes',
    label: 'Facturas por mes',
    desc: 'Timbrado masivo por mes y forma de pago',
    path: '/facturacion/mes',
    accent: 'indigo',
    fase: 3,
    icon: 'calendar',
  },
  {
    id: 'individual',
    label: 'Factura individual',
    desc: 'Una referencia de pago específica',
    path: '/facturacion/individual',
    accent: 'sky',
    fase: 3,
    icon: 'file',
  },
  {
    id: 'publico-general',
    label: 'Público en general',
    desc: 'Facturación masiva RFC genérico por mes',
    path: '/facturacion/publico-general',
    accent: 'violet',
    fase: 4,
    icon: 'users',
  },
  {
    id: 'cancelaciones',
    label: 'Cancelaciones',
    desc: 'Cancelar CFDI ante el SAT (Churchill / Educativo)',
    path: '/facturacion/cancelaciones',
    accent: 'rose',
    fase: 4,
    icon: 'x-circle',
  },
  {
    id: 'devoluciones',
    label: 'Devoluciones',
    desc: 'Notas de crédito por devolución',
    path: '/facturacion/devoluciones',
    accent: 'amber',
    fase: 4,
    icon: 'undo',
  },
  {
    id: 'timbres',
    label: 'Saldo de timbres',
    desc: 'Consulta timbres disponibles en FacturoPorTi',
    path: '/facturacion/timbres',
    accent: 'emerald',
    fase: 4,
    icon: 'ticket',
  },
  {
    id: 'descarga-sat',
    label: 'Descarga masiva SAT',
    desc: 'CFDI recibidos del SAT → Excel (e.firma, no se almacena)',
    path: '/facturacion/descarga-sat',
    accent: 'sky',
    fase: 5,
    icon: 'download',
  },
]

export function facturacionItemPorPath(pathname: string): FacturacionNavItem | undefined {
  return FACTURACION_NAV.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
}
