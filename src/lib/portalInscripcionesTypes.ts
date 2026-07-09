import type { AlumnoRegistro } from './alumnoDatosService'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'

export type PasoInscripcionId =
  | 'solicitud'
  | 'reglamento'
  | 'pago-inscripcion'
  | 'documentos'
  | 'recibo-final'

export type PasoEstadoInscripcion = 'completado' | 'disponible' | 'bloqueado' | 'atencion'

export type BloqueoInscripcion =
  | 'inactivo'
  | 'baja-temporal'
  | 'psicologia'
  | 'adeudos'
  | 'egresado'
  | 'periodo-cerrado'

export interface AccionPasoInscripcion {
  /** 'proximo' = enlace visible pero aún sin destino definido (placeholder). */
  tipo: 'ruta-interna' | 'externo' | 'proximo'
  href: string
  etiqueta: string
}

export interface PasoInscripcion {
  id: PasoInscripcionId
  orden: number
  titulo: string
  descripcion: string
  estado: PasoEstadoInscripcion
  detalle?: string | null
  fechaCompletado?: string | null
  accion?: AccionPasoInscripcion | null
}

export interface ReinscripcionPeriodo {
  periodoInicio: string | null
  fechaLimite: string | null
  diferido: 1 | 2 | null
}

export interface EstadoPortalInscripciones {
  alumno: AlumnoRegistro
  ciclo: CicloEscolarRegistro
  formaIngreso: 0 | 1
  formaIngresoEtiqueta: string
  gradoEtiqueta: string
  bloqueo: BloqueoInscripcion | null
  mensajeBloqueo: string | null
  aviso: string | null
  pasos: PasoInscripcion[]
  pasosCompletados: number
  pasosTotales: number
  progresoPct: number
  /** Importe pendiente del pago de inscripción/reinscripción (si aplica). */
  montoInscripcion: number | null
  /** Ventana de reinscripción (diferidos) para reinscritos. */
  reinscripcion: ReinscripcionPeriodo | null
  /** Pago de inscripción/reinscripción habilitado según ventanas legacy. */
  showPayment?: boolean
  solicitudCapturada?: boolean
  inscripcionPagada?: boolean
}
