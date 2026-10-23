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
  | 'kardex'

/** Kardex por grado y grupo: solo Dirección (directoras y coordinación de inglés del nivel). */
export function puedeKardexNivel(role: RacRolNivel): boolean {
  return role === 'direccion'
}

export function etiquetaRolNivel(role: RacRolNivel, cfg: RacNivelConfig): string {
  if (role === 'maestro') return 'Maestro(a)'
  if (role === 'psicologia') return 'Psicología'
  if (role === 'control_escolar') return cfg.etiquetaOperaciones
  if (role === 'direccion') return 'Dirección'
  if (role === 'estancia') return 'Estancia'
  return 'Coordinación'
}

/** Estancia: solo ve en el historial lo que ella misma capturó. */
export function historialSoloPropioNivel(role: RacRolNivel): boolean {
  return role === 'estancia'
}

/** Estancia atiende toda la primaria (1° a 6°); no opera en maternal/kinder. */
export function puedeCapturarGradoNivel(
  role: RacRolNivel,
  cfg: Pick<RacNivelConfig, 'slug'>,
  nivelEscolar: number,
  grado: number
): boolean {
  if (role !== 'estancia') return true
  return cfg.slug === 'primaria' && nivelEscolar === 3 && grado >= 1 && grado <= 6
}

/** En maternal/kinder no opera la cuenta de prefecta; admin = dirección/coordinación. */
function esPanelAdmin(role: RacRolNivel, cfg?: Pick<RacNivelConfig, 'slug'>): boolean {
  if (role === 'coordinacion' || role === 'direccion') return true
  if (role === 'control_escolar') return cfg?.slug !== 'maternal-kinder'
  return false
}

export function esPanelAdminNivel(
  role: RacRolNivel,
  cfg?: Pick<RacNivelConfig, 'slug'>
): boolean {
  return esPanelAdmin(role, cfg)
}

export function tabsDeRolNivel(
  role: RacRolNivel,
  cfg?: RacNivelConfig
): { id: RacTabNivel; label: string }[] {
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
      { id: 'suspensiones', label: 'Suspensión' },
      { id: 'informes', label: 'Avisos de atención' },
      { id: 'historial', label: 'Historial' },
    ]
  }
  if (role === 'estancia') return [{ id: 'captura', label: 'Reportar' }]
  // Maternal/Kinder: sin prefecta — control escolar no tiene panel operativo aquí.
  if (role === 'control_escolar' && cfg?.slug === 'maternal-kinder') {
    return [
      { id: 'citas', label: 'Citatorios' },
    ]
  }
  // Panel admin completo (dirección / coordinación / control escolar en primaria).
  return [
    { id: 'inbox', label: 'Listado sin confirmar' },
    { id: 'suspensiones', label: 'Suspensión' },
    { id: 'citas', label: 'Citatorios' },
    { id: 'informes', label: 'Informes' },
    { id: 'captura', label: 'Reportar' },
    { id: 'historial', label: 'Impresión' },
    ...(puedeKardexNivel(role) ? [{ id: 'kardex' as const, label: 'Kardex' }] : []),
  ]
}

export function tiposCapturaDeRolNivel(
  role: RacRolNivel,
  fisica: boolean,
  cfg?: Pick<RacNivelConfig, 'slug'>
) {
  if (role === 'psicologia' || role === 'estancia') {
    return [{ valor: RAC_TIPOS.conducta, etiqueta: 'Conducta' }]
  }
  if (role === 'maestro') {
    // Primaria y maternal/kinder: maestras/teachers también capturan uniforme.
    const conUniforme =
      fisica || cfg?.slug === 'maternal-kinder' || cfg?.slug === 'primaria'
    return conUniforme
      ? [...RAC_TIPOS_CAPTURA_MAESTRO, { valor: RAC_TIPOS.uniforme, etiqueta: 'Uniforme' }]
      : RAC_TIPOS_CAPTURA_MAESTRO
  }
  // En maternal/kinder la cuenta de prefecta/control escolar no opera captura de uniforme.
  if (cfg?.slug === 'maternal-kinder' && role === 'control_escolar') {
    return [...RAC_TIPOS_CAPTURA_MAESTRO]
  }
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

export function puedeCapturarTipoNivel(
  role: RacRolNivel,
  tipo: number,
  fisica = false,
  cfg?: Pick<RacNivelConfig, 'slug'>
): boolean {
  return tiposCapturaDeRolNivel(role, fisica, cfg).some((t) => t.valor === tipo)
}

export function puedeCitarNivel(role: RacRolNivel): boolean {
  return role !== 'estancia'
}

export function tiposCitaDeRolNivel(role: RacRolNivel) {
  if (role === 'estancia') return []
  if (role === 'psicologia') return RAC_TIPOS_CITA_PSICOLOGIA
  return [...RAC_TIPOS_CAPTURA_MAESTRO, ...RAC_TIPOS_PREFECTURA]
}

/** Psicología suspende, pero solo por conducta. */
export function suspensionSoloConductaNivel(role: RacRolNivel): boolean {
  return role === 'psicologia'
}

/** Quién puede aplicar la fecha de suspensión (psicología solo en conducta). */
export function puedeSuspenderNivel(role: RacRolNivel, cfg?: Pick<RacNivelConfig, 'slug'>): boolean {
  return esPanelAdmin(role, cfg) || role === 'psicologia'
}

export function puedePdfNivel(
  role: RacRolNivel,
  cfg?: Pick<RacNivelConfig, 'slug'>
): boolean {
  return esPanelAdmin(role, cfg)
}

export function puedeVerVistaCoordNivel(
  role: RacRolNivel,
  vista: string,
  cfg?: RacNivelConfig
): boolean {
  const ids = new Set(tabsDeRolNivel(role, cfg).map((t) => t.id))
  if (vista === 'citas') return ids.has('citas')
  if (vista === 'suspensiones') return ids.has('suspensiones')
  if (vista === 'historial') return ids.has('historial')
  if (vista === 'informes') return ids.has('informes')
  if (vista === 'control_escolar') return esPanelAdmin(role, cfg)
  if (vista === 'pendientes' || vista === 'todos') return ids.has('inbox')
  return false
}

export function puedeAccionCoordNivel(role: RacRolNivel, entidad: string, accion: string): boolean {
  if (role === 'estancia') return false
  if (role === 'maestro') {
    return entidad === 'cita' && (accion === 'reenviar' || accion === 'confirmar')
  }
  if (role === 'psicologia') {
    if (entidad === 'reporte') {
      // Validar/editar/denegar conducta pendiente; reenviar avisos de atención (o reportes ya activos).
      return accion === 'validar' || accion === 'editar' || accion === 'denegar' || accion === 'reenviar'
    }
    if (entidad === 'cita') return accion === 'reenviar' || accion === 'confirmar'
    // Solo suspensiones de conducta: el servicio rechaza las demás.
    if (entidad === 'suspension') return accion === 'aplicar' || accion === 'directa'
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
