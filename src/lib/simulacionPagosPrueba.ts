/**
 * 2026-10-12 — Pagos de prueba de la alumna ficticia LAURA PRUEBA PRUEBA (ref 29905) para probar la Beca SEP
 * en el portal y en los bauchers. Viven solo en memoria: nunca se escriben en pago_detalle, así que no salen
 * en cortes, ingresos ni reportes que lean la tabla. Se suman a lo que devuelve la base al consultar los pagos
 * de ESTE alumno.
 * Ciclo 22 (2025-26) liquidado con plan de 11 meses; ciclo 23 (2026-27): inscripción, cuota de inicio de curso
 * y septiembre (con la beca PEMEX 20 % de la simulación del módulo Beca SEP).
 */
import type { PagoDetalleRegistro } from './pagoColegiaturaService'

const ALUMNO_PRUEBA = { alumnoId: 2680, alumnoRef: '29905' }
export const FORMA_PAGO_SIMULACION = 'SIMULACIÓN DE PRUEBA'

type PagoEjemplo = { concepto: string; importe: number; fecha: string }

const COLEGIATURA_22 = 4400
const MESES_22: Array<[string, string]> = [
  ['01', '2025-09-05'], ['02', '2025-10-05'], ['03', '2025-11-05'], ['04', '2025-12-05'], ['05', '2026-01-05'],
  ['06', '2026-02-05'], ['07', '2026-03-05'], ['08', '2026-04-05'], ['09', '2026-05-05'], ['10', '2026-06-05'],
  ['26', '2026-07-05'],
]

const PAGOS_POR_CICLO: Record<number, PagoEjemplo[]> = {
  22: [
    { concepto: '00', importe: 3140, fecha: '2025-08-10' },
    ...MESES_22.map(([concepto, fecha]) => ({ concepto, importe: COLEGIATURA_22, fecha })),
    { concepto: '16', importe: 600, fecha: '2026-01-05' },
  ],
  23: [
    { concepto: '13', importe: 5490, fecha: '2026-07-15' },
    { concepto: '00', importe: 3300, fecha: '2026-08-10' },
    { concepto: '01', importe: 3944, fecha: '2026-09-08' },
  ],
}

export function esAlumnoPruebaPagos(alumnoId: number | null | undefined): boolean {
  return Number(alumnoId) === ALUMNO_PRUEBA.alumnoId
}

export function pagosSimuladosPrueba(alumnoId: number, cicloEscolar: number): PagoDetalleRegistro[] {
  if (!esAlumnoPruebaPagos(alumnoId)) return []
  const ciclo = String(cicloEscolar).padStart(2, '0').slice(-2)
  return (PAGOS_POR_CICLO[cicloEscolar] ?? []).map((p, i) => ({
    pago_id: -(cicloEscolar * 100 + i + 1),
    alumno_id: ALUMNO_PRUEBA.alumnoId,
    pago_nombre: 'PRUEBA LAURA PRUEBA (simulación)',
    pago_referencia: `${ALUMNO_PRUEBA.alumnoRef}${p.concepto}${ciclo}000`,
    pago_importe: p.importe,
    pago_recargo: 0,
    pago_forma: FORMA_PAGO_SIMULACION,
    pago_folio: null,
    pago_fecha: p.fecha,
    pago_hora: '09:00:00 a.m.',
    pago_emisora: 'S/E',
    pago_cancelado: 0,
    pago_registro: `${p.fecha}T15:00:00.000Z`,
    facturo: null,
  }))
}
