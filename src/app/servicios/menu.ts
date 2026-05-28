import type { LucideIcon } from 'lucide-react'
import {
  Database,
  Users,
  UsersRound,
  Star,
  GraduationCap,
  Wallet,
  CreditCard,
  Mail,
  RefreshCw,
  Ban,
  KeyRound,
  FileText,
  Lock,
  BarChart3,
  CalendarRange,
} from 'lucide-react'

export type ServiciosModuloId =
  | 'migracion-tablas'
  | 'alumnos'
  | 'asignar-grupos'
  | 'becas'
  | 'becas-sep'
  | 'pagos-internos'
  | 'pagos-colegiaturas'
  | 'correo-masivo'
  | 'actualizar-pagos'
  | 'suspensiones'
  | 'credenciales'
  | 'bauchers'
  | 'bloqueados'
  | 'reportes-varios'
  | 'catalogo-ciclos-escolares'

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
  { id: 'pagos-colegiaturas', label: 'Pagos de Colegiaturas', icon: CreditCard },
  { id: 'correo-masivo', label: 'Correo Masivo', icon: Mail },
  { id: 'actualizar-pagos', label: 'Actualizar Pagos', icon: RefreshCw },
  { id: 'suspensiones', label: 'Suspensiones', icon: Ban },
  { id: 'credenciales', label: 'Credenciales', icon: KeyRound },
  { id: 'bauchers', label: 'Bauchers', icon: FileText },
  { id: 'bloqueados', label: 'Bloqueados', icon: Lock },
  { id: 'reportes-varios', label: 'Reportes Varios', icon: BarChart3 },
  { id: 'catalogo-ciclos-escolares', label: 'Catálogo de ciclos escolares', icon: CalendarRange },
]

export function esServiciosModuloId(v: string): v is ServiciosModuloId {
  return SERVICIOS_MENU.some((m) => m.id === v)
}
