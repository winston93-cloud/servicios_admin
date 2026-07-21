/** Tipos de reporte (legacy suspended_type). */
export type TipoReporteSuspension = 1 | 2 | 3 | 4

export const ETIQUETAS_TIPO_SUSPENSION: Record<TipoReporteSuspension, string> = {
  1: 'Deudores inscripción y material/seguro',
  2: 'Deudores desde 1 pago',
  3: 'Deudores 2 pagos o más',
  4: 'Deudores festival diciembre',
}

/** Opciones visibles en el módulo (tipos 1 y 2 no se usan en producción). */
export const TIPOS_SUSPENSION_UI: TipoReporteSuspension[] = [3, 4]

const MESES_CONCEPTO: Record<string, string> = {
  '00': 'CUOTA DE INICIO',
  '01': 'SEP',
  '02': 'OCT',
  '03': 'NOV',
  '04': 'DIC',
  '05': 'ENE',
  '06': 'FEB',
  '07': 'MAR',
  '08': 'ABR',
  '09': 'MAY',
  '10': 'JUN',
  '11': 'JUL',
  '16': 'MAT ENE',
  '12': 'DIF2',
  '13': 'INS',
  '17': 'M&S',
}

/** concepto 11 en referencia = colegiatura julio (plan 11 meses). */
const CONCEPTO_JULIO = '11'

const TABLA_CONCEPTOS_POR_MES_INSCRIPCION: string[][] = [
  [''],
  ['05', '06', '07', '08', '09', '10'],
  ['06', '07', '08', '09', '10'],
  ['07', '08', '09', '10'],
  ['08', '09', '10'],
  ['09', '10'],
  ['10'],
  ['00', '01', '02', '03', '04', '16', '05', '06', '07', '08', '09', '10'],
  ['00', '01', '02', '03', '04', '16', '05', '06', '07', '08', '09', '10'],
  ['01', '02', '03', '04', '16', '05', '06', '07', '08', '09', '10'],
  ['02', '03', '04', '16', '05', '06', '07', '08', '09', '10'],
  ['03', '04', '16', '05', '06', '07', '08', '09', '10'],
  ['04', '16', '05', '06', '07', '08', '09', '10'],
]

/** Mes calendario → concepto colegiatura (legacy `$mes` en verificarAdeudos). */
const MES_A_CONCEPTO: string[] = [
  '',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '',
  '',
  '01',
  '02',
  '03',
  '04',
]

function conceptosANombres(codigos: string[]): string[] {
  return codigos.map((c) => MESES_CONCEPTO[c] ?? c)
}

function mesCalendarioEfectivo(fecha = new Date()): number {
  let m = fecha.getMonth() + 1
  if (fecha.getDate() < 10) m--
  if (m < 1) m = 12
  return m
}

function conceptosEsperadosAcumulados(
  fechaInscripcion: string,
  cicloLargo: number,
  planMes: number | null,
  fechaRef = new Date()
): string[] {
  const [anioStr, mesStr] = fechaInscripcion.split('-')
  let mi = parseInt(mesStr, 10)
  const anioInsc = parseInt(anioStr, 10)
  if (anioInsc === cicloLargo && mi < 7) mi = 7

  const mesActual = mesCalendarioEfectivo(fechaRef)
  const tabla = TABLA_CONCEPTOS_POR_MES_INSCRIPCION[mi] ?? []
  const conceptoMesActual = MES_A_CONCEPTO[mesActual]

  // Julio/agosto: legacy `$mes` vacío → array_search falla → solo el 1.er concepto esperado.
  let esperados: string[]
  if (!conceptoMesActual) {
    esperados = tabla.length ? [tabla[0]] : []
  } else {
    const idx = tabla.indexOf(conceptoMesActual)
    if (idx < 0) esperados = [...tabla]
    else esperados = tabla.slice(0, idx + 1)
  }

  if (planMes === 2 && mesActual >= 7 && !esperados.includes(CONCEPTO_JULIO)) {
    esperados = [...esperados, CONCEPTO_JULIO]
  }

  return esperados
}

function adeudosInscripcionMaterial(pagos: string[]): string[] | null {
  const adeudos: string[] = []
  if (!pagos.includes('13')) {
    if (!pagos.includes('11')) adeudos.push('INS')
    else if (!pagos.includes('12')) adeudos.push('DIF2')
  }
  if (!pagos.includes('17')) adeudos.push('M&S')
  return adeudos.length ? adeudos : null
}

export function calcularAdeudosAlumno(
  tipo: TipoReporteSuspension,
  pagosConcepto: string[],
  fechaInscripcion: string | null,
  cicloLargo: number,
  planMes: number | null,
  fechaRef = new Date()
): string | null {
  const pagos = [...new Set(pagosConcepto.map((p) => p.padStart(2, '0').slice(-2)))]

  if (tipo === 1) {
    const lista = adeudosInscripcionMaterial(pagos)
    return lista?.length ? lista.join(', ') : null
  }

  if (!fechaInscripcion) return null

  const festival = tipo === 4
  const umbral = tipo === 2 ? 0 : tipo === 3 ? 1 : 0

  const esperados = conceptosEsperadosAcumulados(
    fechaInscripcion,
    cicloLargo,
    planMes,
    fechaRef
  )
  let faltantes = esperados.filter((c) => !pagos.includes(c))

  if (festival) {
    faltantes = faltantes.filter((c) => c === '04' || c === '16')
  }

  if (faltantes.length > umbral) {
    return conceptosANombres(faltantes).join(', ')
  }
  return null
}

export function cicloLargoDesdeValorCiclo(valorCiclo: number): number {
  return valorCiclo + 2003
}

export function plantelDesdeNivel(nivel: number): 1 | 2 {
  return nivel === 1 || nivel === 2 ? 1 : 2
}

export function nivelesPorPlantel(plantel: 1 | 2): number[] {
  return plantel === 1 ? [1, 2] : [3, 4]
}
