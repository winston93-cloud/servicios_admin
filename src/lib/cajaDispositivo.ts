/**
 * Identifica la computadora/navegador que cobra en caja (bitácora de pagos internos).
 * El id vive en localStorage del dispositivo: distingue la caja de Juanita de la de Karla aunque usen la misma cuenta.
 */
const CLAVE = 'servicios-admin-caja-dispositivo'

export type DispositivoCaja = { id: string; navegador: string }

function navegadorCorto(ua: string): string {
  const so = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad/i.test(ua)
        ? 'iOS'
        : /Mac OS/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Otro'
  const nav = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Otro'
  return `${nav} · ${so}`
}

export function dispositivoCaja(): DispositivoCaja | null {
  if (typeof window === 'undefined') return null
  let id = ''
  try {
    id = window.localStorage.getItem(CLAVE) ?? ''
    if (!id) {
      id = `caja-${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(CLAVE, id)
    }
  } catch {
    id = 'sin-almacenamiento'
  }
  return { id, navegador: navegadorCorto(window.navigator.userAgent) }
}
