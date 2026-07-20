/** Valores de `alumno_status` en BD. */
export const ESTATUS_ALUMNO_OPCIONES = [
  { valor: 0, etiqueta: 'Baja general' },
  { valor: 1, etiqueta: 'Activo' },
  { valor: 2, etiqueta: 'Inactivo' },
  { valor: 3, etiqueta: 'Baja temporal' },
  { valor: 4, etiqueta: 'Bloqueo psicológico / académico' },
] as const

/** Estatus 4: no avanza de ciclo (bloqueo psicología o académico). */
export const ESTATUS_ALUMNO_BLOQUEO = 4

export type EstatusAlumnoValor = (typeof ESTATUS_ALUMNO_OPCIONES)[number]['valor']

export function parseEstatusAlumno(
  status: string | number | null | undefined
): number | null {
  if (status == null || status === '') return null
  const n = typeof status === 'number' ? status : parseInt(String(status), 10)
  return Number.isNaN(n) ? null : n
}

export function estatusAlumnoPorDefecto(
  status: string | number | null | undefined
): EstatusAlumnoValor {
  const n = parseEstatusAlumno(status)
  if (n != null && ESTATUS_ALUMNO_OPCIONES.some((o) => o.valor === n)) {
    return n as EstatusAlumnoValor
  }
  return 1
}

/** Clase en el `<form>` para colorear campos según estatus. */
export function etiquetaEstatusAlumno(
  status: string | number | null | undefined
): string {
  const n = parseEstatusAlumno(status)
  const opt = ESTATUS_ALUMNO_OPCIONES.find((o) => o.valor === n)
  if (opt) return opt.etiqueta
  if (n != null) return `Estatus ${n}`
  return 'Sin estatus'
}

/** Clase del badge de estatus en resultados de búsqueda. */
export function claseTagEstatusAlumno(status: number | null): string {
  switch (status) {
    case 0:
      return 'alumno-ac-tag--estatus-baja'
    case 2:
      return 'alumno-ac-tag--estatus-inactivo'
    case 3:
      return 'alumno-ac-tag--estatus-baja-temporal'
    case ESTATUS_ALUMNO_BLOQUEO:
      return 'alumno-ac-tag--estatus-bloqueo'
    case 1:
    default:
      return 'alumno-ac-tag--estatus-activo'
  }
}

export function claseFormularioPorEstatus(status: number): string {
  switch (status) {
    case 0:
      return 'alumno-form--estatus-baja'
    case 2:
      return 'alumno-form--estatus-inactivo'
    case 3:
      return 'alumno-form--estatus-baja-temporal'
    case ESTATUS_ALUMNO_BLOQUEO:
      return 'alumno-form--estatus-bloqueo'
    case 1:
    default:
      return 'alumno-form--estatus-activo'
  }
}
