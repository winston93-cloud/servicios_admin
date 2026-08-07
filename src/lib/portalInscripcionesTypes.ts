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

/** Factura CFDI del pago de inscripción/reinscripción (mismo flujo que colegiaturas). */
export interface FacturaPasoInscripcion {
  conceptoNo: string
  etiqueta: string
  pdf: string
  xml: string
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
  /** Si ya pagó e ingresó factura: botones PDF/XML en lugar del comprobante genérico. */
  facturas?: FacturaPasoInscripcion[] | null
}

export interface ReinscripcionPeriodo {
  periodoInicio: string | null
  fechaLimite: string | null
  diferido: 1 | 2 | null
}

export interface CierreCicloPortal {
  /** True si aún debe liquidar el ciclo anterior antes de reinscribirse. */
  requerido: boolean
  liquidado: boolean
  ciclo: { valor: number; nombre: string }
  planEtiqueta: string
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
  /**
   * Ya pagó cuota de inicio de curso (00) del ciclo de colegiaturas.
   * Implica proceso de inscripción cerrado + plan elegido (no depender de localStorage).
   */
  cuotaInicioCursoPagada?: boolean
  /**
   * Progreso de pasos de vista (reglamento / recibo / plan) persistido en servidor
   * para que no se pidan de nuevo al abrir en otra PC.
   */
  progresoInscripcion?: {
    reglamentoVisto: boolean
    reciboFinalVisto: boolean
    planConfirmado: boolean
  }
  /** Reinscritos: liquidar ciclo anterior antes de la admisión. NI = null. */
  cierreCiclo?: CierreCicloPortal | null
  /**
   * Adeudo opcional de doble titulación (23/24/25) de un ciclo anterior.
   * No bloquea inscripción ni colegiaturas del ciclo nuevo.
   */
  dobleAdeudoPrevio?: {
    ciclo: { valor: number; nombre: string }
    pendientes: string[]
  } | null
  /**
   * Ciclo cuyas colegiaturas se muestran al desbloquear pagos
   * (reinscrito = destino 23; NI = ciclo de la ficha).
   */
  cicloColegiaturas?: { valor: number; nombre: string } | null
  /**
   * Acceso temporal de egresado (adeudos del ciclo que terminó).
   * No es reinscripción: solo matriz de pendientes de ese ciclo.
   */
  modoAdeudoEgresado?: boolean
}
