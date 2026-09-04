export const RAC_NIVEL_SECUNDARIA = 4

export const RAC_TIPOS = {
  academico: 1,
  conducta: 2,
  uniforme: 3,
  vialidad: 4,
  informeAcademico: 5,
  retardo: 6,
  seguimiento: 7,
  avisoPsicologia: 8,
} as const

export function etiquetaTipoReporte(tipo: number): string {
  switch (tipo) {
    case 1:
      return 'Académico'
    case 2:
      return 'de Conducta'
    case 3:
      return 'Reporte de Uniforme'
    case 4:
      return 'Reporte de Vialidad'
    case 5:
      return 'Informe Académico'
    case 6:
      return 'Reporte por Retardo'
    case 7:
      return 'por Seguimiento'
    case 8:
      return 'Aviso de atención en Psicología'
    default:
      return 'Desconocido'
  }
}

export function etiquetaTipoCitatorio(tipo: number): string {
  switch (tipo) {
    case 1:
      return 'Académico'
    case 2:
      return 'por Conducta'
    case 3:
      return 'por Uniforme'
    case 4:
      return 'por Vialidad'
    case 6:
      return 'por Retardo'
    case 7:
      return 'por Seguimiento'
    default:
      return 'Desconocido'
  }
}

export function etiquetaEscalon(tipo: number, no: number): string {
  if (tipo === 5) return 'Informe'
  if (tipo === 8) return 'Aviso'
  if (tipo > 2) return 'Reporte'
  if (no <= 0) return 'Aviso'
  if (no === 1) return 'Reporte I'
  if (no === 2) return 'Reporte II'
  if (no === 3) return 'Reporte III'
  return `Reporte ${no}`
}

/**
 * Frase para el cuerpo del correo a papás (sin duplicar «Reporte informe»).
 * Ej. «Informe académico», «Aviso de conducta», «Reporte I académico».
 */
export function fraseRegistroAvisoRac(tipo: number, no: number): string {
  if (tipo === 5) return 'Informe académico'
  if (tipo === 8) return 'Aviso de atención en Psicología'
  if (tipo === 3) return 'Reporte de uniforme'
  if (tipo === 4) return 'Reporte de vialidad'
  if (tipo === 6) return 'Reporte por retardo'
  if (tipo === 1) {
    if (no <= 0) return 'Aviso académico'
    if (no === 1) return 'Reporte académico I'
    if (no === 2) return 'Reporte académico II'
    if (no === 3) return 'Reporte académico III'
    return `Reporte académico ${no}`
  }
  if (tipo === 2) {
    if (no <= 0) return 'Aviso de conducta'
    if (no === 1) return 'Reporte de conducta I'
    if (no === 2) return 'Reporte de conducta II'
    if (no === 3) return 'Reporte de conducta III'
    return `Reporte de conducta ${no}`
  }
  return `${etiquetaEscalon(tipo, no)} ${etiquetaTipoReporte(tipo)}`.trim()
}

export function motivoReporte(tipo: number, motivo: number): string {
  if (tipo === 1) {
    if (motivo === 1) return 'Incumplimiento de tarea'
    if (motivo === 2) return 'Incumplimiento de trabajo en clase'
    if (motivo === 3) return 'Libro y cuaderno'
  }
  if (tipo === 2) {
    if (motivo === 1) return 'Conducta inapropiada'
    if (motivo === 2) return 'Lenguaje inapropiado'
    if (motivo === 3) return 'Faltas al reglamento'
  }
  if (tipo === 3) {
    const u: Record<number, string> = {
      1: 'Camisa',
      2: 'Pantalón',
      3: 'Corbata',
      4: 'Short',
      5: 'Blusa',
      6: 'Calcetas',
      7: 'Corte de pelo',
      8: 'Zapatos',
      9: 'Cinturón',
      10: 'Pants',
      11: 'Tenis',
      12: 'Falda',
      13: 'Uñas',
      14: 'Chamarra',
    }
    return u[motivo] ?? 'Uniforme'
  }
  if (tipo === 4) {
    if (motivo === 1) return 'Estacionarse enfrente'
    if (motivo === 2) return 'Hacer doble fila'
  }
  if (tipo === 5) return 'Informe'
  if (tipo === 6) {
    if (motivo === 5) return 'Retraso de 5 minutos'
    if (motivo === 10) return 'Retraso de 10 minutos'
    if (motivo === 15) return 'Retraso de 15 minutos'
    if (motivo === 20) return 'Retraso de 20 minutos'
    if (motivo === 25) return 'Retraso de 25 minutos'
    if (motivo === 30) return 'Retraso de 30 minutos'
    if (motivo === 40) return 'Retraso de 40 minutos'
    if (motivo === 50) return 'Retraso de 50 minutos'
    if (motivo === 60) return 'Retraso de 1 hora'
    if (motivo === 70) return 'Retraso mayor a 1 hora'
  }
  return 'Desconocido'
}

export function opcionesMotivo(tipo: number): { valor: number; etiqueta: string }[] {
  if (tipo === 1)
    return [
      { valor: 1, etiqueta: 'Incumplimiento de tarea' },
      { valor: 2, etiqueta: 'Incumplimiento de trabajo en clase' },
      { valor: 3, etiqueta: 'Libro y cuaderno' },
    ]
  if (tipo === 2)
    return [
      { valor: 1, etiqueta: 'Conducta inapropiada' },
      { valor: 2, etiqueta: 'Lenguaje inapropiado' },
      { valor: 3, etiqueta: 'Faltas al reglamento' },
    ]
  if (tipo === 3)
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((valor) => ({
      valor,
      etiqueta: motivoReporte(3, valor),
    }))
  if (tipo === 4)
    return [
      { valor: 1, etiqueta: 'Estacionarse enfrente' },
      { valor: 2, etiqueta: 'Hacer doble fila' },
    ]
  if (tipo === 6)
    return [5, 10, 15, 20, 25, 30, 40, 50, 60, 70].map((valor) => ({
      valor,
      etiqueta: motivoReporte(6, valor),
    }))
  return [{ valor: 0, etiqueta: 'Informe' }]
}

export function etiquetaGradoSecundaria(grado: number): string {
  if (grado === 1) return '1°'
  if (grado === 2) return '2°'
  if (grado === 3) return '3°'
  return `${grado}°`
}

/** Etiqueta de grado para selects de staff (psico / prefectura / dirección). */
export function etiquetaGradoStaffSecundaria(grado: number): string {
  if (grado === 1) return '1° (7mo)'
  if (grado === 2) return '2° (8vo)'
  if (grado === 3) return '3° (9no)'
  return etiquetaGradoSecundaria(grado)
}

/** Departamento emisor según perfil (legacy perfil_clase). */
export function etiquetaDepartamentoRac(perfilId: number): string {
  if (perfilId === 1) return 'Maestro'
  if (perfilId === 4) return 'Psicología'
  if (perfilId === 5) return 'Prefectura'
  if (perfilId === 6) return 'Dirección'
  return 'Coordinación'
}
