// 2026-10-13 — Pruebas: el saldo a favor de la cuota 00 se aplica una sola vez y solo a recargos previos a la ampliación.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  conceptoDestinoCreditoRecargoCuotaInicio,
  montoCreditoRecargoCuotaInicioDesdePagos,
  type PagoParaCredito,
} from './creditoRecargoCuotaInicio'

const pago = (referencia: string, fecha: string, recargo = 0): PagoParaCredito => ({
  pago_referencia: referencia,
  pago_fecha: fecha,
  pago_recargo: recargo,
  pago_cancelado: 0,
})

test('21808: 00 con recargo el 19-ago → descuento solo en septiembre', () => {
  const soloCuota = [pago('218080023114', '2026-08-19', 75)]
  assert.equal(montoCreditoRecargoCuotaInicioDesdePagos(soloCuota, 23), 75)
  assert.equal(conceptoDestinoCreditoRecargoCuotaInicio(soloCuota, 23, 1), '01')

  const conSeptiembre = [...soloCuota, pago('218080123167', '2026-09-02')]
  assert.equal(conceptoDestinoCreditoRecargoCuotaInicio(conSeptiembre, 23, 1), null)

  const conOctubre = [...conSeptiembre, pago('218080223067', '2026-10-08')]
  assert.equal(conceptoDestinoCreditoRecargoCuotaInicio(conOctubre, 23, 1), null)
})

test('21297: 00 pagada tarde (21-sep) → recargo legítimo, sin descuento', () => {
  const pagos = [pago('212970023000', '2026-09-21', 150)]
  assert.equal(montoCreditoRecargoCuotaInicioDesdePagos(pagos, 23), 0)
  assert.equal(conceptoDestinoCreditoRecargoCuotaInicio(pagos, 23, 1), null)
})

test('00 con recargo el 24-ago sin colegiaturas pagadas → descuento pendiente en septiembre', () => {
  const pagos = [pago('201770023000', '2026-08-24', 75)]
  assert.equal(montoCreditoRecargoCuotaInicioDesdePagos(pagos, 23), 75)
  assert.equal(conceptoDestinoCreditoRecargoCuotaInicio(pagos, 23, 1), '01')
})

test('septiembre pagado antes de la regla (antes del 21-ago) → descuento en octubre', () => {
  const pagos = [pago('215670023000', '2026-07-21', 50), pago('215670123000', '2026-08-10')]
  assert.equal(conceptoDestinoCreditoRecargoCuotaInicio(pagos, 23, 1), '02')
})

test('otros ciclos no generan saldo a favor', () => {
  const pagos = [pago('218080024000', '2027-08-10', 75)]
  assert.equal(montoCreditoRecargoCuotaInicioDesdePagos(pagos, 24), 0)
})
