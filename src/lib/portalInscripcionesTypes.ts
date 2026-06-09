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
  tipo: 'ruta-interna' | 'externo'
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
}
