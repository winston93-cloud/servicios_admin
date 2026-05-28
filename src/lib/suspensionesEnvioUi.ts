export type EstadoEnvioSuspension =
  | 'idle'
  | 'pendiente'
  | 'enviando'
  | 'ok'
  | 'error'
  | 'omitido'

export interface EstadoFilaEnvio {
  estado: EstadoEnvioSuspension
  mensaje?: string
}

export function etiquetaEstadoEnvioSuspension(estado: EstadoEnvioSuspension): string {
  switch (estado) {
    case 'pendiente':
      return 'En cola'
    case 'enviando':
      return 'Enviando…'
    case 'ok':
      return 'Enviado'
    case 'error':
      return 'Error'
    case 'omitido':
      return 'Omitido'
    default:
      return '—'
  }
}

export function claseEstadoEnvioSuspension(estado: EstadoEnvioSuspension): string {
  return `sus-estado sus-estado--${estado === 'idle' ? 'idle' : estado}`
}

export function claseFilaEnvioSuspension(estado: EstadoEnvioSuspension): string {
  if (estado === 'enviando') return 'sus-fila--enviando'
  if (estado === 'ok') return 'sus-fila--ok'
  if (estado === 'error') return 'sus-fila--error'
  return ''
}
