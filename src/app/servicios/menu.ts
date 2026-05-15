import type { LucideIcon } from 'lucide-react'
import {
  Database,
  Users,
  UsersRound,
  Star,
  GraduationCap,
  Wallet,
  Tags,
  CreditCard,
  BookOpenCheck,
  Mail,
  RefreshCw,
  Ban,
  Receipt,
  Calculator,
  KeyRound,
  CalendarClock,
  ClipboardList,
  FileText,
  Lock,
  BarChart3,
} from 'lucide-react'

export type ServiciosModuloId =
  | 'migracion-tablas'
  | 'alumnos'
  | 'asignar-grupos'
  | 'becas'
  | 'becas-sep'
  | 'pagos-internos'
  | 'precios-pagos-internos'
  | 'pagos-colegiaturas'
  | 'pagos-inscripcion'
  | 'correo-masivo'
  | 'actualizar-pagos'
  | 'suspensiones'
  | 'facturacion-colegiaturas'
  | 'facturacion-contable'
  | 'credenciales'
  | 'prorrogas'
  | 'reporte-inscritos'
  | 'bauchers'
  | 'bloqueados'
  | 'reportes-varios'

export interface ServiciosMenuItem {
  id: ServiciosModuloId
  label: string
  icon: LucideIcon
}

export const SERVICIOS_MENU: ServiciosMenuItem[] = [
  { id: 'migracion-tablas', label: 'Migración de tablas', icon: Database },
  { id: 'alumnos', label: 'Alumnos', icon: Users },
  { id: 'asignar-grupos', label: 'Asignar Grupos', icon: UsersRound },
  { id: 'becas', label: 'Becas', icon: Star },
  { id: 'becas-sep', label: 'Becas SEP', icon: GraduationCap },
  { id: 'pagos-internos', label: 'Pagos Internos', icon: Wallet },
  { id: 'precios-pagos-internos', label: 'Precios Pagos Internos', icon: Tags },
  { id: 'pagos-colegiaturas', label: 'Pagos de Colegiaturas', icon: CreditCard },
  { id: 'pagos-inscripcion', label: 'Pagos de Inscripción', icon: BookOpenCheck },
  { id: 'correo-masivo', label: 'Correo Masivo', icon: Mail },
  { id: 'actualizar-pagos', label: 'Actualizar Pagos', icon: RefreshCw },
  { id: 'suspensiones', label: 'Suspensiones', icon: Ban },
  { id: 'facturacion-colegiaturas', label: 'Facturación Colegiaturas', icon: Receipt },
  { id: 'facturacion-contable', label: 'Facturación Contable', icon: Calculator },
  { id: 'credenciales', label: 'Credenciales', icon: KeyRound },
  { id: 'prorrogas', label: 'Prórrogas', icon: CalendarClock },
  { id: 'reporte-inscritos', label: 'Reporte de Inscritos', icon: ClipboardList },
  { id: 'bauchers', label: 'Bauchers', icon: FileText },
  { id: 'bloqueados', label: 'Bloqueados', icon: Lock },
  { id: 'reportes-varios', label: 'Reportes Varios', icon: BarChart3 },
]

export function esServiciosModuloId(v: string): v is ServiciosModuloId {
  return SERVICIOS_MENU.some((m) => m.id === v)
}
