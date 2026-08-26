import type { RacRolNivel } from './racNivelConfig'
import type { RacNivelConfig } from './racNivelConfig'
import { RAC_TIPOS } from '@/lib/racCatalogo'
import { RAC_TIPOS_CAPTURA_MAESTRO, RAC_TIPOS_PREFECTURA } from '@/lib/racUi'

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

export function tabsDeRolNivel(role: RacRolNivel, cfg: RacNivelConfig): { id: RacTabNivel; label: string }[] {
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
  if (role === 'control_escolar') {
    return [
      { id: 'control_escolar', label: cfg.etiquetaOperaciones },
      { id: 'citas', label: 'Citatorios' },
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

export function tiposCapturaDeRolNivel(role: RacRolNivel, fisica: boolean) {
  if (role === 'psicologia') return [{ valor: RAC_TIPOS.conducta, etiqueta: 'Conducta' }]
  if (role === 'control_escolar') return RAC_TIPOS_PREFECTURA
  if (role === 'maestro') {
    return fisica
      ? [...RAC_TIPOS_CAPTURA_MAESTRO, { valor: RAC_TIPOS.uniforme, etiqueta: 'Uniforme' }]
      : RAC_TIPOS_CAPTURA_MAESTRO
  }
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

export function puedeCapturarTipoNivel(role: RacRolNivel, tipo: number, fisica = false): boolean {
  return tiposCapturaDeRolNivel(role, fisica).some((t) => t.valor === tipo)
}

export function puedeInformeNivel(role: RacRolNivel): boolean {
  return role !== 'control_escolar'
}

export function puedeVerVistaCoordNivel(role: RacRolNivel, vista: string): boolean {
  if (role === 'maestro') return vista === 'citas'
  if (role === 'psicologia') {
    return ['captura', 'inbox', 'citas', 'informes'].includes(vista) || vista === 'pendientes'
  }
  if (role === 'control_escolar') {
    return vista === 'control_escolar' || vista === 'citas'
  }
  return true
}

export function puedeAccionCoordNivel(role: RacRolNivel, entidad: string, accion: string): boolean {
  if (role === 'maestro' || role === 'control_escolar') return false
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
