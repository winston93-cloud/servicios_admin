import { NIVELES_TALLER } from './talleresTypes'

/** Clave en localStorage. Valor: `0` = sin fijo (Todos), `1`–`4` = nivel. Ausente = aún no eligió. */
export const CLAVE_TALLERES_NIVEL_PREF = 'talleres-nivel-preferido'

/** `null` = no ha decidido; `0` = continuar sin fijo; `1`–`4` = nivel fijo. */
export type NivelPreferidoTalleres = number | null

export function esNivelPreferidoValido(n: unknown): n is number {
  if (n === 0) return true
  return typeof n === 'number' && NIVELES_TALLER.some((x) => x.valor === n)
}

export function leerNivelPreferido(): NivelPreferidoTalleres {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CLAVE_TALLERES_NIVEL_PREF)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return esNivelPreferidoValido(n) ? n : null
  } catch {
    return null
  }
}

export function guardarNivelPreferido(nivel: number): void {
  if (!esNivelPreferidoValido(nivel)) return
  try {
    localStorage.setItem(CLAVE_TALLERES_NIVEL_PREF, String(nivel))
  } catch {
    /* sin almacenamiento */
  }
}

export function etiquetaNivelPreferido(nivel: number): string {
  if (nivel === 0) return 'Sin nivel fijo'
  return NIVELES_TALLER.find((n) => n.valor === nivel)?.etiqueta ?? `Nivel ${nivel}`
}
