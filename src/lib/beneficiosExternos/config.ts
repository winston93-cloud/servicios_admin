/**
 * 2026-10-10 — Beneficios externos (becas fuera del Colegio, p. ej. Beca SEP).
 * Módulo nuevo e independiente del módulo de Becas actual: no lee ni escribe
 * tablas de becas, no guarda respuestas y solo lo ven ruben (1), mario (17) y alan (38).
 */

/** Únicos usuario_id que ven las tarjetas y pueden abrir las páginas. */
export const BENEFICIOS_EXTERNOS_USUARIOS: readonly number[] = [1, 17, 38]

export function puedeVerBeneficiosExternos(usuarioId: unknown): boolean {
  const uid = Number(usuarioId) || 0
  return uid > 0 && BENEFICIOS_EXTERNOS_USUARIOS.includes(uid)
}

export type BeneficioExternoId = 'sep' | 'otra'

export type OpcionBeneficioExterno = {
  id: BeneficioExternoId
  label: string
  desc: string
}

export const OPCIONES_BENEFICIO_EXTERNO: readonly OpcionBeneficioExterno[] = [
  {
    id: 'sep',
    label: 'Beca SEP',
    desc: 'Programa de becas de la SEP para escuelas particulares.',
  },
  {
    id: 'otra',
    label: 'Otra beca o apoyo externo',
    desc: 'Gobierno, empresa, fundación u otra institución.',
  },
]

/** Portal donde la familia sube la autorización de la Beca SEP (login con No. de control). */
export function urlSubirDocumentoBecaSep(): string {
  const explicit = process.env.NEXT_PUBLIC_BECAS_SEP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return 'https://becas-renovacion.vercel.app/sep'
}

/** Panel donde el personal revisa los documentos de Beca SEP. */
export function urlRevisionBecaSep(): string {
  const explicit = process.env.NEXT_PUBLIC_BECAS_SEP_ADMIN_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return 'https://becas-renovacion.vercel.app/admin/sep'
}
