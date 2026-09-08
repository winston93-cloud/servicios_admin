import type { RacRolNivel } from './racNivelConfig'
import type { RacNivelConfig } from './racNivelConfig'
import { RAC_TIPOS } from '@/lib/racCatalogo'
import {
  RAC_TIPOS_CAPTURA_MAESTRO,
  RAC_TIPOS_CITA_PSICOLOGIA,
  RAC_TIPOS_PREFECTURA,
} from '@/lib/racUi'

export type RacTabNivel =
  | 'captura'
  | 'inbox'
  | 'citas'
  | 'suspensiones'
  | 'control_escolar'
  | 'historial'
  | 'informes'

export function etiquetaRolNivel(role: RacRolNivel, cfg: RacNivelConfig): string {
  if (role === 'maestro') return 'Maestro(a)'
  if (role === 'psicologia') return 'Psicología'
  if (role === 'control_escolar') return cfg.etiquetaOperaciones
  if (role === 'direccion') return 'Dirección'
  return 'Coordinación'
}

/** Coordinación = Dirección = Control escolar: mismo panel operativo. */
function esPanelAdmin(role: RacRolNivel): boolean {
  return role === 'coordinacion' || role === 'direccion' || role === 'control_escolar'
}

/** Alias público: panel de dirección/control escolar/coordinación. */
export function esPanelAdminNivel(role: RacRolNivel): boolean {
  return esPanelAdmin(role)
}

/**
 * Paneles: maestro / psicología / admin
 * (dirección = control escolar = coordinación).
 */
export function tabsDeRolNivel(
  role: RacRolNivel,
  cfg: RacNivelConfig
): { id: RacTabNivel; label: string }[] {
  void cfg
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
      { id: 'historial', label: 'Historial' },
    ]
  }
  // control_escolar / direccion / coordinacion
  return [
    { id: 'inbox', label: 'Listado sin confirmar' },
    { id: 'suspensiones', label: 'Suspensión' },
    { id: 'citas', label: 'Citatorios' },
    { id: 'informes', label: 'Informes' },
    { id: 'captura', label: 'Reportar' },
    { id: 'historial', label: 'Impresión' },
  ]
}

export function tiposCapturaDeRolNivel(role: RacRolNivel, fisica: boolean) {
  if (role === 'psicologia') return [{ valor: RAC_TIPOS.conducta, etiqueta: 'Conducta' }]
  if (role === 'maestro') {
    return fisica
      ? [...RAC_TIPOS_CAPTURA_MAESTRO, { valor: RAC_TIPOS.uniforme, etiqueta: 'Uniforme' }]
      : RAC_TIPOS_CAPTURA_MAESTRO
  }
  // Admin (incl. control escolar): mismos tipos que prefectura/dirección en secundaria.
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

export function puedeCapturarTipoNivel(role: RacRolNivel, tipo: number, fisica = false): boolean {
  return tiposCapturaDeRolNivel(role, fisica).some((t) => t.valor === tipo)
}

export function puedeInformeNivel(role: RacRolNivel): boolean {
  void role
  return true
}

export function tiposCitaDeRolNivel(role: RacRolNivel) {
  if (role === 'psicologia') return RAC_TIPOS_CITA_PSICOLOGIA
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

export function puedePdfNivel(role: RacRolNivel): boolean {
  return esPanelAdmin(role)
}

export function puedeVerVistaCoordNivel(
  role: RacRolNivel,
  vista: string,
  cfg?: RacNivelConfig
): boolean {
  const tabs = tabsDeRolNivel(
    role,
    cfg ??
      ({
        etiquetaOperaciones: 'Control escolar',
      } as RacNivelConfig)
  )
  const ids = new Set(tabs.map((t) => t.id))
  if (vista === 'citas') return ids.has('citas')
  if (vista === 'suspensiones') return ids.has('suspensiones')
  if (vista === 'historial') return ids.has('historial')
  if (vista === 'informes') return ids.has('informes')
  if (vista === 'pendientes' || vista === 'todos') return ids.has('inbox')
  if (vista === 'control_escolar') return esPanelAdmin(role)
  return false
}

export function puedeAccionCoordNivel(role: RacRolNivel, entidad: string, accion: string): boolean {
  if (role === 'maestro') return false
  if (role === 'psicologia') {
    if (entidad === 'reporte') return accion === 'validar' || accion === 'denegar'
    if (entidad === 'cita') return accion === 'reenviar' || accion === 'confirmar'
    return false
  }
  // Admin panel (dirección / coordinación / control escolar)
  if (entidad === 'suspension') return true
  if (entidad === 'cita') return true
  if (entidad === 'reporte') {
    if (accion === 'validar' || accion === 'denegar') return false
    return accion === 'reenviar' || accion === 'confirmar' || accion === 'detener'
  }
  return false
}
