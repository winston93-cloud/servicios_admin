/**
 * Overrides de importe para pruebas de pago en portal (solo refs listadas).
 * Quitar o vaciar cuando terminen las pruebas.
 */
export const PORTAL_PRUEBA_IMPORTES_POR_REF: Record<
  number,
  Partial<Record<string, number>>
> = {
  // Vacío: se eliminó el alumno de prueba INSCRIPCION TRES / PRUEBA (ref 21903).
}

export function importePruebaPortal(
  alumnoRef: string | number | null | undefined,
  conceptoNo: string
): number | null {
  const ref = Number(alumnoRef)
  if (!Number.isFinite(ref) || ref <= 0) return null
  const mapa = PORTAL_PRUEBA_IMPORTES_POR_REF[ref]
  if (!mapa) return null
  const c = String(conceptoNo).padStart(2, '0')
  const monto = mapa[c] ?? mapa[conceptoNo]
  return monto != null && monto > 0 ? monto : null
}
