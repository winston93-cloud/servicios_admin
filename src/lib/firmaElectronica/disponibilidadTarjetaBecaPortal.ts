/** Lunes 31 ago 2026, 8:30 a.m. hora Ciudad de México (sin horario de verano). */
export const INICIO_TARJETA_BECA_PORTAL_CDMX = '2026-08-31T08:30:00-06:00'

export function instanteInicioTarjetaBecaPortal(): number {
  return new Date(INICIO_TARJETA_BECA_PORTAL_CDMX).getTime()
}

export function tarjetaBecaPortalDisponible(ahora = new Date()): boolean {
  return ahora.getTime() >= instanteInicioTarjetaBecaPortal()
}

export function mensajeTarjetaBecaPortalPendiente(): string {
  return 'La firma de carta de beca estará disponible a partir del lunes 31 de agosto de 2026, a las 8:30 a.m. (hora Ciudad de México).'
}

/** Tarjeta y flujo de firma en portal: beca ya firmada, o autorizada y pasó la fecha de apertura. */
export function becaFirmaVisibleEnPortal(opts: {
  autorizada: boolean
  activada: boolean
  ahora?: Date
}): boolean {
  if (opts.activada) return true
  if (!opts.autorizada) return false
  return tarjetaBecaPortalDisponible(opts.ahora)
}
