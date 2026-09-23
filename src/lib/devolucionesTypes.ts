/** Tipos y constantes seguros para cliente y servidor (sin deps nativas). */

export const DEVOLUCIONES_BUCKET = 'devoluciones'
export const DEVOLUCION_ETAPAS_TOTAL = 5
export const ADJUNTO_MAX_BYTES = 5 * 1024 * 1024

export type DevolucionAdjunto = {
  id: number
  devolucion_id: number
  storage_key: string
  storage_url: string
  nombre_archivo: string
  mime_type: string
  bytes: number
  subido_por: string | null
  created_at: string
}

export type DevolucionTarjeta = {
  id: number
  asunto: string
  realizado_por: string
  usuario_id: number | null
  storage_key: string
  storage_url: string
  mime_type: string
  slack_ok: boolean
  slack_error: string | null
  etapa: number
  slack_admvo_ok: boolean
  slack_admvo_error: string | null
  etapa2_at: string | null
  etapa2_por: string | null
  cheque_numero: number | null
  cheque_entidad: string | null
  /** pendiente_firma | firmado | null */
  cheque_firma_status: string | null
  etapa3_at: string | null
  etapa3_por: string | null
  etapa4_at: string | null
  etapa4_por: string | null
  etapa5_at: string | null
  etapa5_por: string | null
  created_at: string
  adjuntos: DevolucionAdjunto[]
}
