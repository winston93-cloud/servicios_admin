/**
 * 2026-10-12 — Módulo Becas: resumen de la Beca SEP (activa, renuncia a beca del colegio, revertida).
 * Ejecutar: npm run test:becas-sep
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumenBecaSep, type FilaBecaSepResumen } from './resumenBecaSep'

const base: FilaBecaSepResumen = {
  ciclo_valor: 23,
  estatus: 'activa',
  origen: 'becas_renovacion',
  porcentaje_sep: '50.00',
  porcentaje_beca_actual: '20.00',
  monto_mensual: '2042.60',
  meses_restantes: 10,
  plan_meses: 11,
  saldo_favor: '0.00',
  anio_completo: false,
  fecha_otorgamiento: '2026-10-12',
  aprobado_en: null,
  aprobado_por: 'ce_pri',
  desglose: { folio: 'SEP-1', becaSustituida: { clase: 'PEMEX', porcentaje: 20 }, reversion: null },
}

test('activa: dice a qué beca del colegio renunció y que se cobra en automático', () => {
  const r = resumenBecaSep(base)!
  assert.equal(r.estado, 'activa')
  assert.equal(r.porcentajeSep, 50)
  assert.equal(r.montoMensual, 2042.6)
  assert.deepEqual(r.becaRenunciada, { clase: 'PEMEX', porcentaje: 20 })
  assert.equal(r.cobroAutomatico, true)
})

test('carga inicial 2025-26 sin beca anterior: no renunció a nada y no es cobro automático', () => {
  const r = resumenBecaSep({ ...base, ciclo_valor: 22, origen: 'carga_inicial_excel_25_26', porcentaje_beca_actual: '0.00', desglose: null })!
  assert.equal(r.becaRenunciada, null)
  assert.equal(r.cobroAutomatico, false)
})

test('revertida: estatus cancelada con reversión autorizada y la nueva mensualidad', () => {
  const r = resumenBecaSep({
    ...base,
    estatus: 'cancelada',
    desglose: {
      ...base.desglose,
      reversion: { estado: 'autorizada', motivo: 'La familia prefiere su beca', resueltaPor: 'direccion', resueltaEn: '2026-10-20T10:00:00Z', calculo: { mensual: 3500 } },
    },
  })!
  assert.equal(r.estado, 'revertida')
  assert.equal(r.reversion?.mensual, 3500)
  assert.equal(r.becaRenunciada?.clase, 'PEMEX')
})

test('sin fila: null', () => {
  assert.equal(resumenBecaSep(null), null)
})
