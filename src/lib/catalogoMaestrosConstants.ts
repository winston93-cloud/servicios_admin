import type { NivelEscolarValor } from './nivelEscolar'

/** Pestañas del catálogo en Servicios. */
export type CatalogoMaestrosTab = 'maternal-kinder' | 'primaria' | 'secundaria'

export type CatalogoMaestrosSubTab = 'maestros' | 'materias' | 'asignaciones'

export const CATALOGO_MAESTROS_TABS: {
  id: CatalogoMaestrosTab
  label: string
  niveles: NivelEscolarValor[]
}[] = [
  { id: 'maternal-kinder', label: 'Maternal / Kinder', niveles: [1, 2] },
  { id: 'primaria', label: 'Primaria', niveles: [3] },
  { id: 'secundaria', label: 'Secundaria', niveles: [4] },
]

/** Materias fijas por grado+grupo (español / inglés). */
export const MATERIA_SLOT_ES = {
  nombre: 'Maestro(a)',
  orden: 1,
} as const

export const MATERIA_SLOT_EN = {
  nombre: 'Teacher',
  orden: 2,
} as const

export const GRUPOS_ASIGNACION = ['A', 'B', 'C'] as const

export function nivelesDeTab(tab: CatalogoMaestrosTab): NivelEscolarValor[] {
  const hit = CATALOGO_MAESTROS_TABS.find((t) => t.id === tab)
  return hit?.niveles ?? [4]
}

export function esModoMateriasLibres(tab: CatalogoMaestrosTab): boolean {
  return tab === 'secundaria'
}

export function subTabsDeNivel(tab: CatalogoMaestrosTab): CatalogoMaestrosSubTab[] {
  if (tab === 'secundaria') return ['maestros', 'materias', 'asignaciones']
  return ['maestros', 'asignaciones']
}

/** Nivel por defecto al dar de alta en la pestaña activa. */
export function nivelDefaultAlta(tab: CatalogoMaestrosTab): NivelEscolarValor {
  if (tab === 'maternal-kinder') return 2
  if (tab === 'primaria') return 3
  return 4
}

export function etiquetaNivelMaestro(nivel: number): string {
  if (nivel === 1) return 'Maternal'
  if (nivel === 2) return 'Kinder'
  if (nivel === 3) return 'Primaria'
  if (nivel === 4) return 'Secundaria'
  return `Nivel ${nivel}`
}
