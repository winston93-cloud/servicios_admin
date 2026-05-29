const GRUPOS = ['', 'A', 'B', 'C', 'D']

export function etiquetaGrupo(grupo: number): string {
  return GRUPOS[grupo] ?? ''
}

/** Texto de grado en credencial (legacy callback_3). */
export function etiquetaGradoCredencial(nivel: number, grado: number): string {
  if (nivel === 1) return grado === 1 ? 'Maternal A' : 'Maternal B'
  if (nivel === 2) return `Kinder-${grado}`
  if (nivel === 3) return `${grado}° Primaria`
  if (nivel === 4) {
    if (grado === 1) return '7mo'
    if (grado === 2) return '8vo'
    if (grado === 3) return '9no'
    return `${grado}°`
  }
  return `${grado}°`
}

export function etiquetaNivelMaestro(nivel: number): string {
  switch (nivel) {
    case 1:
      return 'Maternal'
    case 2:
      return 'Kinder'
    case 3:
      return 'Primaria'
    case 4:
      return 'Secundaria'
    default:
      return 'Docente'
  }
}
