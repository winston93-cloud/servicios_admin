/** Días y observaciones de una suspensión (los 3 niveles): validación y textos para la familia. */

export const SUSPENSION_DIAS_MAX = 30
export const SUSPENSION_OBSERVACIONES_MAX = 3000

export function validarDiasSuspension(raw: unknown): number {
  const dias = raw == null || raw === '' ? 1 : Math.trunc(Number(raw))
  if (!Number.isFinite(dias) || dias < 1 || dias > SUSPENSION_DIAS_MAX) {
    throw new Error(`Días de suspensión: de 1 a ${SUSPENSION_DIAS_MAX}.`)
  }
  return dias
}

export function validarObservacionesSuspension(raw: unknown): string | null {
  const t = String(raw ?? '').trim()
  if (t.length > SUSPENSION_OBSERVACIONES_MAX) throw new Error('Las observaciones son demasiado largas.')
  return t || null
}

export function diasDeSuspension(s: Record<string, unknown>): number {
  const d = Math.trunc(Number(s.suspension_dias))
  return Number.isFinite(d) && d >= 1 ? d : 1
}

/** «el día 2026-10-22» o «3 días a partir del 2026-10-22». */
export function textoDiasSuspension(s: Record<string, unknown>): string {
  const fecha = String(s.suspension_fecha ?? '').slice(0, 10)
  const dias = diasDeSuspension(s)
  return dias === 1 ? `el día ${fecha}` : `${dias} días a partir del ${fecha}`
}

export function observacionesDeSuspension(s: Record<string, unknown>): string {
  return String(s.suspension_observaciones ?? '').trim()
}

/** Párrafo de observaciones para el correo ('' si no hay). */
export function htmlObservacionesSuspension(s: Record<string, unknown>, escapeHtml: (t: string) => string): string {
  const obs = observacionesDeSuspension(s)
  if (!obs) return ''
  return `<p><b>Observaciones:</b></p><p style="white-space:pre-line">${escapeHtml(obs)}</p>`
}

/** Texto para la página de enterado: duración y observaciones. */
export function detalleSuspensionPublico(s: Record<string, unknown>): string {
  const dias = diasDeSuspension(s)
  const obs = observacionesDeSuspension(s)
  return [`Duración: ${dias === 1 ? '1 día' : `${dias} días`}.`, obs ? `Observaciones: ${obs}` : ''].filter(Boolean).join('\n\n')
}
