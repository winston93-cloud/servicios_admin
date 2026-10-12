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

/**
 * 2026-10-12 — Interruptor para las familias: con NEXT_PUBLIC_BENEFICIOS_EXTERNOS_FAMILIAS=1 la tarjeta
 * aparece en el dashboard de todos los alumnos. Apagado, solo la ven los números de control de prueba
 * (NEXT_PUBLIC_BENEFICIOS_EXTERNOS_REFS_PRUEBA, por defecto 29905). Cambiarlo requiere redeploy.
 */
export function beneficiosExternosAbiertoAFamilias(): boolean {
  return process.env.NEXT_PUBLIC_BENEFICIOS_EXTERNOS_FAMILIAS === '1'
}

export function refsPruebaBeneficiosExternos(): number[] {
  const crudo = process.env.NEXT_PUBLIC_BENEFICIOS_EXTERNOS_REFS_PRUEBA?.trim()
  if (!crudo) return [29905]
  return crudo
    .split(',')
    .map((r) => Number(r.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

export function esRefPruebaBeneficiosExternos(alumnoRef: unknown): boolean {
  return refsPruebaBeneficiosExternos().includes(Number(alumnoRef) || 0)
}

export function familiaVeBeneficiosExternos(alumnoRef: unknown): boolean {
  return beneficiosExternosAbiertoAFamilias() || esRefPruebaBeneficiosExternos(alumnoRef)
}

/** Ciclo escolar vigente (misma regla que el portal de becas: cambia el 10 de julio). */
export function cicloBeneficiosExternos(ahora = new Date()): number {
  const mes = ahora.getMonth() + 1
  const inicio = mes > 7 || (mes === 7 && ahora.getDate() >= 10) ? ahora.getFullYear() : ahora.getFullYear() - 1
  return inicio - 2003
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
