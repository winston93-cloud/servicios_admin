/** Solo sistemas (mario). */
export const PANEL_CONTROL_USUARIOS: readonly number[] = [17]

export const PANEL_CONTROL_REFRESCO_MS = 30_000

export type EstadoMedidor = 'normal' | 'precaucion' | 'alarma' | 'sin-dato'

/** Salud 0–100: debajo del primero alarma, debajo del segundo precaución. */
export const UMBRALES_SALUD: [number, number] = [60, 90]

/** Una pieza de infraestructura de un proceso (pasarela, servicio externo, base, tarea programada). */
export type PiezaMedida = {
  id: string
  nombre: string
  /** Salud 0–100; null si no hubo actividad ni sonda. */
  valor: number | null
  estado: EstadoMedidor
  /** Lectura corta: tiempo de respuesta, fallos, latido. */
  lectura: string
  /** Último fallo del sistema, si lo hubo. */
  fallo?: string
}

export type MedidorProceso = {
  id: string
  nombre: string
  /** Qué vigila el proceso, en una línea. */
  mide: string
  /** Salud del proceso = la de su pieza más débil. */
  valor: number | null
  estado: EstadoMedidor
  piezas: PiezaMedida[]
  /** Pieza que manda la lectura cuando no está en normal. */
  motivo?: string
}

export type PanelControlRespuesta = {
  leidoEn: string
  medidores: MedidorProceso[]
}

export function estadoPorValor(valor: number | null, [a, b]: [number, number] = UMBRALES_SALUD): EstadoMedidor {
  if (valor == null || !Number.isFinite(valor)) return 'sin-dato'
  return valor >= b ? 'normal' : valor >= a ? 'precaucion' : 'alarma'
}
