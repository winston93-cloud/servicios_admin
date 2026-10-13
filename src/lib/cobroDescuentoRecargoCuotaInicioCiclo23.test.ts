// 2026-10-13 — Pruebas: el cobro del descuento aplicado de más solo se suma a noviembre ciclo 23 y si está activo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COBROS_DESCUENTO_RECARGO_00_CICLO23,
  cobroDescuentoRecargo00Pendiente,
} from './cobroDescuentoRecargoCuotaInicioCiclo23'

const activa = [{ alumnoRef: 21297, nombre: 'PRUEBA', monto: 300, activo: true }]

// 2026-10-13 — Activados todos menos 20245 (en revisión) y 21903 (no debe).
const NO_ACTIVOS = [20245, 21903]

test('lista oficial: 30 alumnos, $2,675, activos todos menos los excluidos', () => {
  assert.equal(COBROS_DESCUENTO_RECARGO_00_CICLO23.length, 30)
  const total = COBROS_DESCUENTO_RECARGO_00_CICLO23.reduce((s, c) => s + c.monto, 0)
  assert.equal(total, 2675)
  assert.deepEqual(
    COBROS_DESCUENTO_RECARGO_00_CICLO23.filter((c) => !c.activo).map((c) => c.alumnoRef).sort(),
    [...NO_ACTIVOS].sort()
  )
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '03', cicloEscolar: 23 }), 300)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 20971, conceptoNo: '03', cicloEscolar: 23 }), 150)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21903, conceptoNo: '03', cicloEscolar: 23 }), 0)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 20245, conceptoNo: '03', cicloEscolar: 23 }), 0)
})

test('fila activa: se suma solo en noviembre (03) del ciclo 23', () => {
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '03', cicloEscolar: 23 }, activa), 300)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: 3, cicloEscolar: 23 }, activa), 300)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '04', cicloEscolar: 23 }, activa), 0)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '03', cicloEscolar: 24 }, activa), 0)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21808, conceptoNo: '03', cicloEscolar: 23 }, activa), 0)
})
