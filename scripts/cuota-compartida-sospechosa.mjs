/**
 * Cancela folio espejo erróneo y genera reporte de cuotas compartidas sospechosas.
 * Uso: node --env-file=.env.local scripts/cuota-compartida-sospechosa.mjs [--cancelar-folio=2288]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createAdminClient } from '@insforge/sdk'

const url = process.env.NEXT_PUBLIC_INSFORGE_URL || process.env.INSFORGE_URL
const key = process.env.INSFORGE_API_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_INSFORGE_URL o INSFORGE_API_KEY')
  process.exit(1)
}

const db = createAdminClient({ baseUrl: url, apiKey: key }).database

const TUTOR_MADRE = 1
const TUTOR_PADRE = 2
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/

function normalizarCurp(curp) {
  const c = String(curp ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return c.length === 18 && CURP_RE.test(c) ? c : ''
}

function normalizarCel(cel) {
  const digits = String(cel ?? '').replace(/\D/g, '')
  const ten = digits.length >= 10 ? digits.slice(-10) : digits
  return ten.length === 10 ? ten : ''
}

function esCelConfiable(cel10) {
  if (!cel10 || cel10.length !== 10) return false
  if (/^(\d)\1{9}$/.test(cel10)) return false
  if (cel10 === '0000000000' || cel10.startsWith('000000')) return false
  return true
}

function normalizarNombre(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function claveParental(row) {
  const tutorId = Number(row.tutor_id)
  const curp = normalizarCurp(row.familiar_curp)
  if (curp) return `curp:${tutorId}:${curp}`
  const cel = normalizarCel(row.familiar_cel)
  if (!esCelConfiable(cel)) return null
  const app = normalizarNombre(row.familiar_app)
  const apm = normalizarNombre(row.familiar_apm)
  if (app.length < 2) return null
  return `cel:${tutorId}:${cel}:${app}:${apm}`
}

function compartenClave(a, b) {
  const clavesB = new Set()
  for (const row of b) {
    const k = claveParental(row)
    if (k) clavesB.add(k)
  }
  if (!clavesB.size) return false
  for (const row of a) {
    const k = claveParental(row)
    if (k && clavesB.has(k)) return true
  }
  return false
}

async function fetchFamiliares(alumnoId) {
  const { data, error } = await db
    .from('alumno_familiar')
    .select('tutor_id, familiar_cel, familiar_curp, familiar_app, familiar_apm')
    .eq('alumno_id', alumnoId)
    .in('tutor_id', [TUTOR_MADRE, TUTOR_PADRE])
  if (error) throw new Error(error.message)
  return data ?? []
}

async function alumnoPorRef(ref) {
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado')
    .eq('alumno_ref', ref)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function alumnoPorId(id) {
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado')
    .eq('alumno_id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function nombreAlumno(a) {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ').trim()
}

async function cancelarEspejoPagoId(pagoId) {
  const { data: pago, error } = await db
    .from('pago_interno')
    .select('pago_id, alumno_id, pago_folio, pago_importe, concepto_otro, pago_cancelado')
    .eq('pago_id', pagoId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!pago) {
    console.log(`pago_id ${pagoId}: no encontrado`)
    return
  }
  if (Number(pago.pago_cancelado) === 1) {
    console.log(`pago_id ${pagoId}: ya estaba cancelado`)
    return
  }
  const extra = String(pago.concepto_otro ?? '')
  if (!extra.toLowerCase().includes('cuota compartida')) {
    console.error(`pago_id ${pagoId}: no es espejo de cuota compartida — use cancelación manual en UI`)
    process.exit(1)
  }
  const ahora = new Date().toISOString()
  const { error: upErr } = await db
    .from('pago_interno')
    .update({ pago_cancelado: 1, pago_actualizacion: ahora })
    .eq('pago_id', pagoId)
  if (upErr) throw new Error(upErr.message)
  const al = await alumnoPorId(pago.alumno_id)
  console.log(
    `Espejo cancelado: pago_id ${pagoId} · folio ${pago.pago_folio} · ${nombreAlumno(al ?? {})} · ${extra}`
  )
}

async function cancelarFolioCuota(folio) {
  const { data: pagos, error } = await db
    .from('pago_interno')
    .select('pago_id, alumno_id, pago_folio, pago_importe, concepto_otro, pago_cancelado, concepto_id')
    .eq('pago_folio', folio)
    .in('concepto_id', [1, 2])
    .eq('pago_cancelado', 0)

  if (error) throw new Error(error.message)
  if (!pagos?.length) {
    console.log(`Folio ${folio}: no hay pagos vigentes de cuota de padres.`)
    return
  }

  const ahora = new Date().toISOString()
  const { data: updated, error: upErr } = await db
    .from('pago_interno')
    .update({ pago_cancelado: 1, pago_actualizacion: ahora })
    .eq('pago_folio', folio)
    .eq('pago_cancelado', 0)
    .in('concepto_id', [1, 2])
    .select('pago_id, alumno_id, concepto_otro')

  if (upErr) throw new Error(upErr.message)
  console.log(`Folio ${folio} cancelado (${updated?.length ?? 0} registro(s)):`)
  for (const r of updated ?? []) {
    const al = await alumnoPorId(r.alumno_id)
    console.log(`  - pago_id ${r.pago_id} · ${nombreAlumno(al ?? {})} · ${r.concepto_otro ?? ''}`)
  }
}

async function cargarEspejosCuota() {
  const rows = []
  let offset = 0
  const page = 500
  while (true) {
    const { data, error } = await db
      .from('pago_interno')
      .select(
        'pago_id, alumno_id, pago_folio, pago_importe, pago_fecha, pago_ciclo_escolar, concepto_otro, pago_cancelado'
      )
      .eq('pago_cancelado', 0)
      .ilike('concepto_otro', 'Cuota compartida c/ hermano%')
      .range(offset, offset + page - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    rows.push(...chunk)
    if (chunk.length < page) break
    offset += page
  }
  return rows
}

async function analizarEspejos(espejos) {
  const filas = []
  for (const p of espejos) {
    const extra = String(p.concepto_otro ?? '')
    const m = extra.match(/hermano\s+(\S+)/i)
    const refPagador = m?.[1] ?? ''
    const alumnoEspejo = await alumnoPorId(p.alumno_id)
    const alumnoPagador = refPagador ? await alumnoPorRef(refPagador) : null

    let sospechoso = false
    let motivo = ''

    if (!alumnoPagador) {
      sospechoso = true
      motivo = 'No se encontró alumno pagador por ref en concepto_otro'
    } else if (Number(alumnoEspejo?.alumno_nivel) !== Number(alumnoPagador.alumno_nivel)) {
      sospechoso = true
      motivo = 'Distinto nivel escolar'
    } else {
      const famEspejo = await fetchFamiliares(p.alumno_id)
      const famPagador = await fetchFamiliares(alumnoPagador.alumno_id)
      const vinculo = compartenClave(famEspejo, famPagador)
      if (!vinculo) {
        sospechoso = true
        motivo = 'Sin CURP ni cel+apellidos compartidos (regla nueva)'
      }
    }

    filas.push({
      sospechoso,
      motivo,
      pago_id: p.pago_id,
      folio: p.pago_folio,
      fecha: p.pago_fecha,
      ciclo: p.pago_ciclo_escolar,
      importe: p.pago_importe,
      ref_espejo: alumnoEspejo?.alumno_ref ?? '',
      nombre_espejo: nombreAlumno(alumnoEspejo ?? {}),
      ref_pagador: refPagador,
      nombre_pagador: nombreAlumno(alumnoPagador ?? {}),
      concepto_otro: extra,
    })
  }
  return filas.sort((a, b) => Number(b.sospechoso) - Number(a.sospechoso) || a.folio - b.folio)
}

function aCsv(filas) {
  const headers = [
    'sospechoso',
    'motivo',
    'pago_id',
    'folio',
    'fecha',
    'ciclo',
    'importe',
    'ref_espejo',
    'nombre_espejo',
    'ref_pagador',
    'nombre_pagador',
    'concepto_otro',
  ]
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...filas.map((f) => headers.map((h) => esc(f[h])).join(','))].join('\n')
}

async function main() {
  const cancelPagoArg = process.argv.find((a) => a.startsWith('--cancelar-espejo-pago-id='))
  if (cancelPagoArg) {
    await cancelarEspejoPagoId(Number(cancelPagoArg.split('=')[1]))
  }

  const cancelArg = process.argv.find((a) => a.startsWith('--cancelar-folio='))
  if (cancelArg) {
    console.warn('AVISO: --cancelar-folio cancela TODOS los pagos de cuota en ese folio.')
    const folio = Number(cancelArg.split('=')[1])
    await cancelarFolioCuota(folio)
  }

  console.log('\nAnalizando espejos de cuota compartida…')
  const espejos = await cargarEspejosCuota()
  const filas = await analizarEspejos(espejos)
  const sospechosos = filas.filter((f) => f.sospechoso)
  const ok = filas.filter((f) => !f.sospechoso)

  const outPath = resolve(process.cwd(), 'tmp/cuota-compartida-sospechosa.csv')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, aCsv(filas), 'utf8')

  console.log(`\nTotal espejos vigentes: ${filas.length}`)
  console.log(`  Válidos (vínculo familiar): ${ok.length}`)
  console.log(`  Sospechosos: ${sospechosos.length}`)
  console.log(`Reporte: ${outPath}\n`)

  if (sospechosos.length) {
    console.log('--- Sospechosos ---')
    for (const f of sospechosos) {
      console.log(
        `Folio ${f.folio} · ${f.nombre_espejo} (${f.ref_espejo}) ← pagó ${f.nombre_pagador} (${f.ref_pagador}) · ${f.motivo}`
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
