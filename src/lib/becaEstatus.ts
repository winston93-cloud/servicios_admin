export const BECA_ESTATUS_INACTIVA = 0
export const BECA_ESTATUS_ACTIVA = 1
export const BECA_ESTATUS_VALIDACION = 2

export const BECA_ESTATUS_OPCIONES = [
  { valor: BECA_ESTATUS_INACTIVA, etiqueta: 'Inactiva' },
  { valor: BECA_ESTATUS_ACTIVA, etiqueta: 'Activa' },
  { valor: BECA_ESTATUS_VALIDACION, etiqueta: 'En validación' },
] as const

export function etiquetaBecaEstatus(estatus: number): string {
  return BECA_ESTATUS_OPCIONES.find((o) => o.valor === estatus)?.etiqueta ?? `Estatus ${estatus}`
}

export function claseBecaEstatus(estatus: number): string {
  switch (estatus) {
    case BECA_ESTATUS_ACTIVA:
      return 'becas-estatus--activa'
    case BECA_ESTATUS_VALIDACION:
      return 'becas-estatus--validacion'
    case BECA_ESTATUS_INACTIVA:
    default:
      return 'becas-estatus--inactiva'
  }
}
