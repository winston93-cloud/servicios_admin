/** El papá ya aceptó el aviso de Winston USA Program para este concepto en esta sesión del navegador. */
const CLAVE = 'winston-usa-aviso-aceptado'

function leer(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(CLAVE) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function avisoUsaAceptado(alumnoId: number, conceptoNo: string): boolean {
  return leer().has(`${alumnoId}:${conceptoNo}`)
}

export function marcarAvisoUsaAceptado(alumnoId: number, conceptoNo: string): void {
  try {
    const s = leer()
    s.add(`${alumnoId}:${conceptoNo}`)
    sessionStorage.setItem(CLAVE, JSON.stringify([...s]))
  } catch {
    /* sessionStorage no disponible: se vuelve a mostrar el aviso. */
  }
}
