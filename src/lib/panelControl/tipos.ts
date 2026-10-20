/** Solo sistemas (mario). */
export const PANEL_CONTROL_USUARIOS: readonly number[] = [17]

export const PANEL_CONTROL_REFRESCO_MS = 30_000

export type EstadoMedidor = 'normal' | 'precaucion' | 'alarma' | 'sin-dato'

/**
 * `alto-bueno`: rojo abajo, verde arriba (actividad, cumplimiento).
 * `bajo-bueno`: verde abajo, rojo arriba (uso de recursos).
 */
export type SentidoMedidor = 'alto-bueno' | 'bajo-bueno'

export type MedidorProceso = {
  id: string
  nombre: string
  /** Qué mide la barra, en una línea. */
  mide: string
  /** 0–100; null si no hay lectura. */
  valor: number | null
  sentido: SentidoMedidor
  /** Límites de franja en la escala 0–100: [ámbar, verde] si alto-bueno; [ámbar, rojo] si bajo-bueno. */
  umbrales: [number, number]
  estado: EstadoMedidor
  /** Texto corto para la lectura digital cuando no es un porcentaje. */
  lectura?: string
  detalle: string[]
  /** Causa de la alarma cuando no sale de la posición de la barra. */
  motivo?: string
}

export type PanelControlRespuesta = {
  leidoEn: string
  medidores: MedidorProceso[]
}

export function estadoPorValor(
  valor: number | null,
  sentido: SentidoMedidor,
  [a, b]: [number, number]
): EstadoMedidor {
  if (valor == null || !Number.isFinite(valor)) return 'sin-dato'
  if (sentido === 'alto-bueno') return valor >= b ? 'normal' : valor >= a ? 'precaucion' : 'alarma'
  return valor < a ? 'normal' : valor < b ? 'precaucion' : 'alarma'
}
