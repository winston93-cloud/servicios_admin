// 2026-10-13 — Pruebas: el cobro del descuento aplicado de más solo se suma a noviembre ciclo 23 y si está activo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COBROS_DESCUENTO_RECARGO_00_CICLO23,
  cobroDescuentoRecargo00Pendiente,
} from './cobroDescuentoRecargoCuotaInicioCiclo23'

const activa = [{ alumnoRef: 21297, nombre: 'PRUEBA', monto: 300, activo: true }]

// 2026-10-13 — Activadas tras la llamada: 20971 (Alvarado Pérez).
const ACTIVADOS = [20971]

test('lista oficial: 30 alumnos, $2,750, solo activos los ya contactados', () => {
  assert.equal(COBROS_DESCUENTO_RECARGO_00_CICLO23.length, 30)
  const total = COBROS_DESCUENTO_RECARGO_00_CICLO23.reduce((s, c) => s + c.monto, 0)
  assert.equal(total, 2750)
  assert.deepEqual(
    COBROS_DESCUENTO_RECARGO_00_CICLO23.filter((c) => c.activo).map((c) => c.alumnoRef).sort(),
    [...ACTIVADOS].sort()
  )
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '03', cicloEscolar: 23 }), 0)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 20971, conceptoNo: '03', cicloEscolar: 23 }), 150)
})

test('fila activa: se suma solo en noviembre (03) del ciclo 23', () => {
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '03', cicloEscolar: 23 }, activa), 300)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: 3, cicloEscolar: 23 }, activa), 300)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '04', cicloEscolar: 23 }, activa), 0)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21297, conceptoNo: '03', cicloEscolar: 24 }, activa), 0)
  assert.equal(cobroDescuentoRecargo00Pendiente({ alumnoRef: 21808, conceptoNo: '03', cicloEscolar: 23 }, activa), 0)
})
