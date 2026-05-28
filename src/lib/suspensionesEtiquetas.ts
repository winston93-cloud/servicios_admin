const GRUPOS = ['', 'A', 'B', 'C', 'D']

export function etiquetaNivel(nivel: number): string {
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
      return `Nivel ${nivel}`
  }
}

export function etiquetaNivelGrado(nivel: number, grado: number, grupo: number): string {
  const g = GRUPOS[grupo] ?? String(grupo)
  const nv = etiquetaNivel(nivel)

  if (nivel === 4) {
    const ord =
      grado === 1 ? '7mo' : grado === 2 ? '8vo' : grado === 3 ? '9no' : `${grado}°`
    return `${nv} ${ord} ${g}`.trim()
  }

  return `${nv} ${grado}° ${g}`.trim()
}

export function nombrePlantel(plantel: 1 | 2): string {
  return plantel === 1 ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill'
}

export function nombrePlantelCorto(plantel: 1 | 2): string {
  return plantel === 1 ? 'IEW' : 'IWC'
}
