import type { DestinatarioCorreoMasivo, FiltroAdicionalCorreo } from './correoMasivoService'

const STORAGE_KEY = 'correo-masivo-progreso-v1'
const MAX_EDAD_MS = 7 * 24 * 60 * 60 * 1000

export interface ProgresoCorreoMasivoGuardado {
  version: 1
  guardadoEn: string
  cicloFiltro: number
  nivel: number
  grado: number
  grupo: number
  filtroAdicional: FiltroAdicionalCorreo
  asunto: string
  /** Con copia (CC), texto libre; opcional en sesiones antiguas. */
  cc?: string
  mensaje: string
  nombresArchivos: string[]
  destinatarios: DestinatarioCorreoMasivo[]
  resumenTexto: string | null
}

export function guardarProgresoCorreoMasivo(data: Omit<ProgresoCorreoMasivoGuardado, 'version' | 'guardadoEn'>) {
  if (typeof window === 'undefined') return
  try {
    const payload: ProgresoCorreoMasivoGuardado = {
      version: 1,
      guardadoEn: new Date().toISOString(),
      ...data,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn('No se pudo guardar progreso de correo masivo:', e)
  }
}

export function leerProgresoCorreoMasivo(): ProgresoCorreoMasivoGuardado | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as ProgresoCorreoMasivoGuardado
    if (data.version !== 1 || !data.destinatarios?.length) return null
    const edad = Date.now() - new Date(data.guardadoEn).getTime()
    if (Number.isNaN(edad) || edad > MAX_EDAD_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function limpiarProgresoCorreoMasivo() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function resumenProgresoGuardado(destinatarios: DestinatarioCorreoMasivo[]) {
  const enviados = destinatarios.filter(
    (d) => d.estado === 'enviado' || d.estado === 'recibido'
  ).length
  const errores = destinatarios.filter((d) => d.estado === 'error').length
  const pendientes = destinatarios.filter((d) => d.estado === 'pendiente' && d.emails.length > 0)
    .length
  const sinCorreo = destinatarios.filter((d) => d.estado === 'sin-correo').length
  return { enviados, errores, pendientes, sinCorreo, total: destinatarios.length }
}
