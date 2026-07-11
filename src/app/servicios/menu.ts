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
  CalendarRange,
  ScrollText,
  CircleDollarSign,
  CalendarClock,
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
  | 'catalogo-ciclos-escolares'
  | 'cambio-ciclo-escolar'
  | 'reglamentos-escolares'
  | 'costos'
  | 'fechas-diferidos'

export interface ServiciosSubMenuItem {
  id: ServiciosModuloId
  label: string
}

export interface ServiciosMenuLeaf {
  type: 'leaf'
  id: ServiciosModuloId
  label: string
  icon: LucideIcon
}

export interface ServiciosMenuGroup {
  type: 'group'
  id: string
  label: string
  icon: LucideIcon
  children: ServiciosSubMenuItem[]
}

export type ServiciosMenuEntry = ServiciosMenuLeaf | ServiciosMenuGroup

export const SERVICIOS_MENU: ServiciosMenuEntry[] = [
  { type: 'leaf', id: 'migracion-tablas', label: 'Migración de tablas', icon: Database },
  { type: 'leaf', id: 'alumnos', label: 'Alumnos', icon: Users },
  { type: 'leaf', id: 'asignar-grupos', label: 'Asignar Grupos', icon: UsersRound },
  { type: 'leaf', id: 'becas', label: 'Becas', icon: Star },
  { type: 'leaf', id: 'becas-sep', label: 'Becas SEP', icon: GraduationCap },
  { type: 'leaf', id: 'pagos-internos', label: 'Pagos Internos', icon: Wallet },
  { type: 'leaf', id: 'pagos-colegiaturas', label: 'Pagos de Colegiaturas', icon: CreditCard },
  { type: 'leaf', id: 'correo-masivo', label: 'Correo Masivo', icon: Mail },
  { type: 'leaf', id: 'actualizar-pagos', label: 'Actualizar Pagos', icon: RefreshCw },
  { type: 'leaf', id: 'suspensiones', label: 'Suspensiones', icon: Ban },
  { type: 'leaf', id: 'credenciales', label: 'Credenciales', icon: KeyRound },
  { type: 'leaf', id: 'bauchers', label: 'Bauchers', icon: FileText },
  {
    type: 'group',
    id: 'ciclos-escolares',
    label: 'Ciclos escolares',
    icon: CalendarRange,
    children: [
      { id: 'catalogo-ciclos-escolares', label: 'Catálogo de ciclo escolar' },
      { id: 'cambio-ciclo-escolar', label: 'Cambio de ciclo escolar' },
    ],
  },
  { type: 'leaf', id: 'reglamentos-escolares', label: 'Reglamentos', icon: ScrollText },
  { type: 'leaf', id: 'costos', label: 'Costos', icon: CircleDollarSign },
  { type: 'leaf', id: 'fechas-diferidos', label: 'Fechas de diferidos', icon: CalendarClock },
]

const MODULO_IDS = new Set<ServiciosModuloId>(
  SERVICIOS_MENU.flatMap((entry) =>
    entry.type === 'leaf' ? [entry.id] : entry.children.map((c) => c.id)
  )
)

export function esServiciosModuloId(v: string): v is ServiciosModuloId {
  return MODULO_IDS.has(v as ServiciosModuloId)
}

export function etiquetaModulo(id: ServiciosModuloId): string {
  for (const entry of SERVICIOS_MENU) {
    if (entry.type === 'leaf' && entry.id === id) return entry.label
    if (entry.type === 'group') {
      const child = entry.children.find((c) => c.id === id)
      if (child) return child.label
    }
  }
  return id
}

export function grupoContieneModulo(
  group: ServiciosMenuGroup,
  moduloId: ServiciosModuloId
): boolean {
  return group.children.some((c) => c.id === moduloId)
}
