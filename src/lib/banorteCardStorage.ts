export interface DatosTarjetaComercio {
  CUSTOMER_REF1: string
  CARD_NUMBER: string
  CARD_EXP: string
}

export function claveAlmacenamientoBanorte(referencia: string): string {
  return `banorte_ce_${String(referencia).replace(/\D/g, '').slice(0, 12)}`
}

/** Paso 1 → 2 y reintentos (misma origen; localStorage cubre pestañas del banco). */
export function guardarDatosTarjetaComercio(
  referencia: string,
  datos: DatosTarjetaComercio
): void {
  const key = claveAlmacenamientoBanorte(referencia)
  const payload = JSON.stringify(datos)
  try {
    localStorage.setItem(key, payload)
    sessionStorage.setItem(key, payload)
  } catch {
    /* privado / sin almacenamiento */
  }
}
