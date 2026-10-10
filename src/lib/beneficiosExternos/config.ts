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

/**
 * 2026-10-10 — Textos y límites de la vista previa de subida (copiados del portal de becas /sep).
 * La vista previa no lee ni envía el archivo: solo muestra el flujo.
 */
export const MAX_MB_DOCUMENTO_EXTERNO = 5
export const MAX_BYTES_DOCUMENTO_EXTERNO = MAX_MB_DOCUMENTO_EXTERNO * 1024 * 1024
export const TIPOS_DOCUMENTO_EXTERNO = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const MENSAJE_LIMITE_DOCUMENTO_EXTERNO = `El archivo pesa más de ${MAX_MB_DOCUMENTO_EXTERNO} MB y no se puede recibir. Si es foto, tómela con menor calidad; si es PDF, escanéelo en blanco y negro o a menor resolución.`
export const AVISO_OTRAS_BECAS_SEP =
  'Entiendo que al agregar la beca SEP mi hijo(a) pierde el beneficio de cualquier otra beca que tenga en el colegio, que esa beca no se renovará el próximo ciclo escolar (tendría que solicitarla de nuevo), y deseo continuar.'

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
