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
  '11': 'DIF1',
  '12': 'DIF2',
  '13': 'INS',
  '16': 'MAT ENE',
  '17': 'M&S',
  '26': 'JUL',
}

/**
 * Colegiatura de julio: solo plan 11 meses (`alumno.mes = 2`).
 * Concepto en referencia = 26 (no confundir con 11 = DIF1).
 */
const CONCEPTO_JULIO = '26'

/**
 * Secuencia de adeudo para suspendidos / deudores colegiatura.
 * Empieza en cuota de inicio (00) y llega a junio (10).
 * Inscripción (11/12/13) no entra. Julio (26) se suma aparte si plan 11.
 */
const SECUENCIA_DESDE_CUOTA_INICIO: string[] = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '16',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
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

/** Mes “efectivo” para adeudo: antes del día 10 aún no vence el mes en curso. */
function mesCalendarioEfectivo(fecha = new Date()): number {
  let m = fecha.getMonth() + 1
  if (fecha.getDate() < 10) m--
  if (m < 1) m = 12
  return m
}

/**
 * Conceptos esperados desde cuota de inicio (00) hasta el mes vigente.
 * - No usa fecha de inscripción.
 * - Plan 10 meses (`mes=1`): hasta junio (10).
 * - Plan 11 meses (`mes=2`): además julio (26) desde julio calendario.
 */
export function conceptosEsperadosDesdeCuotaInicio(
  planMes: number | null,
  fechaRef = new Date()
): string[] {
  const mesCalendario = fechaRef.getMonth() + 1
  const mesEfectivo = mesCalendarioEfectivo(fechaRef)

  let esperados: string[]

  // Agosto (inicio de ciclo): solo cuota de inicio, sin importar el ajuste día < 10.
  if (mesCalendario === 8) {
    esperados = ['00']
  } else if (mesCalendario === 7) {
    // Julio = cierre de ciclo: plan completo hasta junio.
    esperados = [...SECUENCIA_DESDE_CUOTA_INICIO]
  } else {
    const conceptoMes = MES_A_CONCEPTO[mesEfectivo]
    if (!conceptoMes) {
      esperados = ['00']
    } else {
      const idx = SECUENCIA_DESDE_CUOTA_INICIO.indexOf(conceptoMes)
      if (idx < 0) esperados = [...SECUENCIA_DESDE_CUOTA_INICIO]
      else esperados = SECUENCIA_DESDE_CUOTA_INICIO.slice(0, idx + 1)
    }
  }

  // Julio (26) solo plan 11 meses y solo desde julio calendario.
  if (planMes === 2 && mesCalendario >= 7 && !esperados.includes(CONCEPTO_JULIO)) {
    esperados = [...esperados, CONCEPTO_JULIO]
  }

  // Plan 10 meses (o sin plan) nunca exige julio.
  if (planMes !== 2) {
    esperados = esperados.filter((c) => c !== CONCEPTO_JULIO)
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

export function etiquetaModalidadPlan(planMes: number | null | undefined): string {
  const m = Number(planMes)
  if (m === 1) return '10 meses'
  if (m === 2) return '11 meses'
  return 'N/D'
}

export function calcularAdeudosAlumno(
  tipo: TipoReporteSuspension,
  pagosConcepto: string[],
  /** @deprecated No se usa en tipos 2/3/4; la inscripción no cuenta. */
  _fechaInscripcion: string | null,
  /** @deprecated No se usa en tipos 2/3/4. */
  _cicloLargo: number,
  planMes: number | null,
  fechaRef = new Date()
): string | null {
  const pagos = [...new Set(pagosConcepto.map((p) => p.padStart(2, '0').slice(-2)))]

  if (tipo === 1) {
    const lista = adeudosInscripcionMaterial(pagos)
    return lista?.length ? lista.join(', ') : null
  }

  const festival = tipo === 4
  const umbral = tipo === 2 ? 0 : tipo === 3 ? 1 : 0

  const esperados = conceptosEsperadosDesdeCuotaInicio(planMes, fechaRef)
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
