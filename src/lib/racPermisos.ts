import type { RacRol } from '@/lib/racAuth'
import { RAC_TIPOS } from '@/lib/racCatalogo'
import {
  RAC_TIPOS_CAPTURA_MAESTRO,
  RAC_TIPOS_CITA_PSICOLOGIA,
  RAC_TIPOS_PREFECTURA,
} from '@/lib/racUi'

export type RacTab = 'captura' | 'inbox' | 'citas' | 'suspensiones' | 'prefectura' | 'historial' | 'informes'

export function etiquetaRol(role: RacRol): string {
  if (role === 'maestro') return 'Maestro'
  if (role === 'psicologia') return 'Psicología'
  if (role === 'prefectura') return 'Prefectura'
  if (role === 'direccion') return 'Dirección'
  return 'Coordinación'
}

function esPanelAdmin(role: RacRol): boolean {
  // Prefectura = Dirección = Coordinación: mismo panel (listado, informe, citar, reenvío masivo, etc.).
  return role === 'coordinacion' || role === 'direccion' || role === 'prefectura'
}

/** Alias público: panel de dirección/prefectura/coordinación. */
export function esPanelAdminRac(role: RacRol): boolean {
  return esPanelAdmin(role)
}

/** Paneles: maestro / psicología / admin (dirección = prefectura = coordinación). */
export function tabsDeRol(role: RacRol): { id: RacTab; label: string }[] {
  if (role === 'maestro') {
    return [
      { id: 'captura', label: 'Captura' },
      { id: 'citas', label: 'Citas' },
    ]
  }
  if (role === 'psicologia') {
    return [
      { id: 'captura', label: 'Reportar' },
      { id: 'inbox', label: 'Aprobar reportes' },
      { id: 'citas', label: 'Citatorios' },
      { id: 'informes', label: 'Avisos de atención' },
    ]
  }
  return [
    { id: 'inbox', label: 'Listado sin confirmar' },
    { id: 'suspensiones', label: 'Suspensión' },
    { id: 'citas', label: 'Citatorios' },
    { id: 'informes', label: 'Informes' },
    { id: 'captura', label: 'Reportar' },
    { id: 'historial', label: 'Impresión' },
  ]
}

export function tiposCapturaDeRol(role: RacRol, fisica: boolean) {
  if (role === 'psicologia') return [{ valor: RAC_TIPOS.conducta, etiqueta: 'Conducta' }]
  if (role === 'maestro') {
    return fisica
      ? [...RAC_TIPOS_CAPTURA_MAESTRO, { valor: RAC_TIPOS.uniforme, etiqueta: 'Uniforme' }]
      : RAC_TIPOS_CAPTURA_MAESTRO
  }
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

export function puedeCapturarTipo(role: RacRol, tipo: number, fisica = false): boolean {
  return tiposCapturaDeRol(role, fisica).some((t) => t.valor === tipo)
}

export function puedeInforme(role: RacRol): boolean {
  void role
  return true
}

export function tiposCitaDeRol(role: RacRol) {
  if (role === 'psicologia') return RAC_TIPOS_CITA_PSICOLOGIA
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

export function puedePdfRac(role: RacRol): boolean {
  return esPanelAdmin(role)
}

export function puedeVerVistaCoord(role: RacRol, vista: string): boolean {
  const ids = new Set(tabsDeRol(role).map((t) => t.id))
  if (vista === 'citas') return ids.has('citas')
  if (vista === 'suspensiones') return ids.has('suspensiones')
  if (vista === 'historial') return ids.has('historial')
  if (vista === 'informes') return ids.has('informes')
  if (vista === 'pendientes' || vista === 'todos') return ids.has('inbox')
  return false
}

export function puedeAccionCoord(role: RacRol, entidad: string, accion: string): boolean {
  if (role === 'maestro') return false
  if (role === 'psicologia') {
    if (entidad === 'reporte') return accion === 'validar' || accion === 'denegar'
    if (entidad === 'cita') return accion === 'reenviar' || accion === 'confirmar'
    return false
  }
  if (entidad === 'suspension') return true
  if (entidad === 'cita') return true
  if (entidad === 'reporte') {
    if (accion === 'validar' || accion === 'denegar') return false
    return accion === 'reenviar' || accion === 'confirmar' || accion === 'detener'
  }
  return false
}
