import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from './alumnoFamiliarTutor'

export const TUTOR_IDS_PADRES_CUOTA = [TUTOR_ID_MADRE, TUTOR_ID_PADRE] as const

const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/

export function normalizarCurpFamiliar(curp: string | null | undefined): string {
  const c = String(curp ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (c.length !== 18 || !CURP_RE.test(c)) return ''
  return c
}

/** Celular MX a 10 dígitos (últimos 10 si viene con lada +52). */
export function normalizarCelFamiliar(cel: string | null | undefined): string {
  const digits = String(cel ?? '').replace(/\D/g, '')
  const ten = digits.length >= 10 ? digits.slice(-10) : digits
  return ten.length === 10 ? ten : ''
}

export function esCelFamiliarConfiable(cel10: string): boolean {
  if (!cel10 || cel10.length !== 10) return false
  if (/^(\d)\1{9}$/.test(cel10)) return false
  if (cel10 === '0000000000' || cel10.startsWith('000000')) return false
  return true
}

export function normalizarNombreFamiliar(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

/**
 * Clave estable de vínculo familiar madre/padre ↔ alumno.
 * - CURP válida del tutor: match fuerte.
 * - Sin CURP: cel confiable + apellidos del mismo tutor (evita choques solo por cel).
 */
export function claveParentalFamilia(opts: {
  tutorId: number
  curp?: string | null
  cel?: string | null
  app?: string | null
  apm?: string | null
}): string | null {
  const curp = normalizarCurpFamiliar(opts.curp)
  if (curp) return `curp:${opts.tutorId}:${curp}`

  const cel = normalizarCelFamiliar(opts.cel)
  if (!esCelFamiliarConfiable(cel)) return null
  const app = normalizarNombreFamiliar(opts.app)
  const apm = normalizarNombreFamiliar(opts.apm)
  if (app.length < 2) return null
  return `cel:${opts.tutorId}:${cel}:${app}:${apm}`
}

export type FamiliarParentalRow = {
  tutor_id: number
  familiar_cel?: string | null
  familiar_curp?: string | null
  familiar_app?: string | null
  familiar_apm?: string | null
}

export function buildClavesParentalesFamilia(rows: FamiliarParentalRow[]): Set<string> {
  const keys = new Set<string>()
  for (const r of rows) {
    const k = claveParentalFamilia({
      tutorId: Number(r.tutor_id),
      curp: r.familiar_curp,
      cel: r.familiar_cel,
      app: r.familiar_app,
      apm: r.familiar_apm,
    })
    if (k) keys.add(k)
  }
  return keys
}

export function compartenClaveParental(
  a: FamiliarParentalRow[],
  b: FamiliarParentalRow[]
): boolean {
  const clavesB = buildClavesParentalesFamilia(b)
  if (clavesB.size === 0) return false
  for (const row of a) {
    const k = claveParentalFamilia({
      tutorId: Number(row.tutor_id),
      curp: row.familiar_curp,
      cel: row.familiar_cel,
      app: row.familiar_app,
      apm: row.familiar_apm,
    })
    if (k && clavesB.has(k)) return true
  }
  return false
}
