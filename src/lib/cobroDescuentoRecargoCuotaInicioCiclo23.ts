/**
 * 2026-10-13 — Cobro del saldo a favor de la cuota 00 aplicado de más (ver creditoRecargoCuotaInicio.ts).
 * Autorizado por Dirección General: se suma a la Colegiatura Noviembre (03) del ciclo 23
 * solo cuando `activo` es true; se activa después de hablar con cada familia.
 * Montos estimados al 13-oct (lista de llamadas en Excel).
 * 2026-10-13 — Activados todos tras verificar pago por pago, excepto 20245 (en revisión) y 21903 (no debe).
 */
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

export type CobroDescuentoRecargo00 = {
  alumnoRef: number
  nombre: string
  monto: number
  activo: boolean
  /** 2026-10-13 — Concepto donde se suma si la familia pidió otro mes (por defecto noviembre '03'). */
  conceptoNo?: string
}

export const COBRO_DESCUENTO_RECARGO_00_CICLO = 23
export const COBRO_DESCUENTO_RECARGO_00_CONCEPTO = '03'

export const COBROS_DESCUENTO_RECARGO_00_CICLO23: readonly CobroDescuentoRecargo00[] = [
  { alumnoRef: 20177, nombre: 'ANDRADE MORALES XIMENA', monto: 75.0, activo: true },
  // 2026-10-13 — En revisión: septiembre capturado manual en $5,470; no se sabe si fue descuento o recargo condonado.
  { alumnoRef: 20245, nombre: 'MONTERO IGLESIAS MARIA FERNANDA', monto: 75.0, activo: false },
  { alumnoRef: 20440, nombre: 'ARCOS BRICEÑO MARTHA FERNANDA', monto: 75.0, activo: true },
  { alumnoRef: 20489, nombre: 'BARRON LUNA EMILIA SOFIA', monto: 75.0, activo: true },
  { alumnoRef: 20596, nombre: 'ANDRADE MORALES HELENA', monto: 75.0, activo: true },
  { alumnoRef: 20680, nombre: 'PEREZ GALVEZ FATIMA ISABELLA', monto: 75.0, activo: true },
  { alumnoRef: 20846, nombre: 'RAMIREZ ENRIQUEZ LUIS HUGO', monto: 150.0, activo: true },
  // 2026-10-13 — La mamá pidió que el cargo vaya en octubre.
  { alumnoRef: 20971, nombre: 'ALVARADO PEREZ CARLOS SEBASTIAN', monto: 150.0, activo: true, conceptoNo: '02' },
  { alumnoRef: 21078, nombre: 'MOLINA ARZOLA EMMA ARLETH', monto: 75.0, activo: true },
  { alumnoRef: 21258, nombre: 'RANGEL ARRIAGA MARIA GERALDINE', monto: 75.0, activo: true },
  { alumnoRef: 21276, nombre: 'LOPEZ PADRON ANDREA NATALY', monto: 75.0, activo: true },
  { alumnoRef: 21297, nombre: 'CARPENTER TANGUMA MARIO ALEJANDRO', monto: 300.0, activo: true },
  { alumnoRef: 21504, nombre: 'PEREZ GALVEZ DAVID LIONEL', monto: 75.0, activo: true },
  { alumnoRef: 21567, nombre: 'LEAL MURILLO PABLO CESAR', monto: 50.0, activo: true },
  { alumnoRef: 21621, nombre: 'TRUJILLO ROJAS ANA SOFIA', monto: 50.0, activo: true },
  { alumnoRef: 21757, nombre: 'ANDRADE RESENDIZ VANESSA', monto: 50.0, activo: true },
  { alumnoRef: 21760, nombre: 'GOMEZ GUTIERREZ FRIDA SOFIA', monto: 150.0, activo: true },
  { alumnoRef: 21786, nombre: 'RAMIREZ SANCHEZ SERGIO DANIEL', monto: 100.0, activo: true },
  { alumnoRef: 21808, nombre: 'SAN MARTIN MESA ALEXIA', monto: 75.0, activo: true },
  { alumnoRef: 21809, nombre: 'SAN MARTIN MESA VANESSA', monto: 75.0, activo: true },
  { alumnoRef: 21810, nombre: 'JIMENEZ MORENO REBECA GISELLE', monto: 75.0, activo: true },
  { alumnoRef: 21848, nombre: 'JIMENEZ TORRES CONSTANZA', monto: 150.0, activo: true },
  { alumnoRef: 21853, nombre: 'OSORIO MARTINEZ BARBARA', monto: 100.0, activo: true },
  { alumnoRef: 21870, nombre: 'VARGAS ROMAN JUAN JOSE', monto: 50.0, activo: true },
  { alumnoRef: 21871, nombre: 'VARGAS ROMAN ANNIA LARISSA', monto: 50.0, activo: true },
  { alumnoRef: 21873, nombre: 'LANDAETA ACEVEDO LOREN SUSEJ', monto: 150.0, activo: true },
  { alumnoRef: 21884, nombre: 'LEAL MURILLO MARIA PAULA', monto: 50.0, activo: true },
  { alumnoRef: 21892, nombre: 'RAMIREZ ENRIQUEZ LIAM SANTIAGO', monto: 75.0, activo: true },
  { alumnoRef: 21900, nombre: 'HERNANDEZ GONZALEZ CARLOS ALEXANDER', monto: 75.0, activo: true },
  // 2026-10-13 — Sin cobro: septiembre se pagó completo ($5,900); el descuento solo se aplicó una vez (octubre).
  { alumnoRef: 21903, nombre: 'BENITEZ DEL ANGEL ELIAS', monto: 0, activo: false },
] as const

/** Monto a sumar al concepto (0 si no aplica o el cobro no está activo). */
export function cobroDescuentoRecargo00Pendiente(
  opts: {
    alumnoRef: string | number
    conceptoNo: string | number
    cicloEscolar: number
  },
  lista: readonly CobroDescuentoRecargo00[] = COBROS_DESCUENTO_RECARGO_00_CICLO23
): number {
  if (Number(opts.cicloEscolar) !== COBRO_DESCUENTO_RECARGO_00_CICLO) return 0
  const ref = Number(opts.alumnoRef)
  if (!Number.isFinite(ref)) return 0
  const row = lista.find((c) => c.alumnoRef === ref)
  if (!row?.activo) return 0
  const destino = row.conceptoNo ?? COBRO_DESCUENTO_RECARGO_00_CONCEPTO
  return normalizarConceptoNo(opts.conceptoNo) === normalizarConceptoNo(destino) ? row.monto : 0
}
