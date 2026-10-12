/**
 * 2026-10-12 — Cobro automático Beca SEP: qué montos toma el baucher de alumno_beca_sep.
 * Ejecutar: npm run test:becas-sep
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cobroSepActivo, montosCobroSep } from './cobroSep'

const esperados = { '03': 4108.33, '26': 4108.33, '1': 2465 }

test('activa de becas_renovacion: cobra los montos por concepto (claves normalizadas)', () => {
  const m = montosCobroSep({ estatus: 'activa', origen: 'becas_renovacion', desglose: { esperados } })
  assert.deepEqual(m, { '03': 4108.33, '26': 4108.33, '01': 2465 })
})

test('revertida (cancelada) también respeta los montos de regreso', () => {
  const m = montosCobroSep({ estatus: 'cancelada', origen: 'becas_renovacion_prueba', desglose: { esperados: { '04': 2300.67 } } })
  assert.deepEqual(m, { '04': 2300.67 })
})

test('carga inicial del Excel (ciclo 22) u otros orígenes: no se usan', () => {
  assert.equal(montosCobroSep({ estatus: 'activa', origen: 'carga_inicial_excel_25_26', desglose: { esperados } }), null)
})

test('suspendida, sin desglose o sin fila: no aplica', () => {
  assert.equal(montosCobroSep({ estatus: 'suspendida', origen: 'becas_renovacion', desglose: { esperados } }), null)
  assert.equal(montosCobroSep({ estatus: 'activa', origen: 'becas_renovacion', desglose: null }), null)
  assert.equal(montosCobroSep(null), null)
})

test('interruptor apagado: solo el alumno de prueba', () => {
  const antes = process.env.BECAS_SEP_COBRO
  delete process.env.BECAS_SEP_COBRO
  assert.equal(cobroSepActivo(29905), true)
  assert.equal(cobroSepActivo(21592), false)
  process.env.BECAS_SEP_COBRO = '1'
  assert.equal(cobroSepActivo(21592), true)
  if (antes == null) delete process.env.BECAS_SEP_COBRO
  else process.env.BECAS_SEP_COBRO = antes
})
