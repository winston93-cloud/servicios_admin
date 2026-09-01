#!/usr/bin/env node
/**
 * Alinea folios 3221–3226 con talón físico (1-sep-2026):
 *
 * | Folio | Talón físico              | pago_id |
 * |-------|---------------------------|---------|
 * | 3221  | Viktor Noguera (manuales) | 20925   |
 * | 3222  | Diego López (constancia)  | 20928   |
 * | 3223  | Jesús Emilio Flores       | 20929   |
 * | 3224  | Leonardo Flores           | 20930   |
 * | 3225  | Santiago Ruelas           | 20931   |
 * | 3226  | Externo examen admisión   | 20932   |
 *
 * - Cancela examen domingo 20923 (slot fantasma / duplicado externo)
 * - Siguiente folio sistema → 3227
 *
 * Uso: node --env-file=.env.local scripts/corregir-folios-talon-3221-3226.mjs [--dry-run]
 */
import { createAdminClient } from '@insforge/sdk'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const FUERA = 900_000
const dryRun = process.argv.includes('--dry-run')

function loadEnv() {
  try {
    const p = resolve(process.cwd(), '.env.local')
    const raw = readFileSync(p, 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* optional */
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_INSFORGE_URL || process.env.INSFORGE_URL
const key = process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_API_KEY
if (!url || !key) {
  console.error('Faltan INSFORGE_URL y INSFORGE_API_KEY / SERVICE_ROLE')
  process.exit(1)
}

const db = createAdminClient({ baseUrl: url, apiKey: key }).database

const MOVER_A_FUERA = [20923, 20925, 20928, 20929, 20930, 20931, 20932]

const ASIGNAR = [
  { pagoId: 20925, folio: 3221, label: 'Viktor → 3221' },
  { pagoId: 20928, folio: 3222, label: 'Diego → 3222' },
  { pagoId: 20929, folio: 3223, label: 'Jesús Flores → 3223' },
  { pagoId: 20930, folio: 3224, label: 'Leonardo Flores → 3224' },
  { pagoId: 20931, folio: 3225, label: 'Santiago Ruelas → 3225' },
  { pagoId: 20932, folio: 3226, label: 'Externo examen → 3226' },
]

const CE_FOLIOS = [
  { pagoId: 20928, folio: 3222 },
  { pagoId: 20929, folio: 3223 },
  { pagoId: 20930, folio: 3224 },
  { pagoId: 20931, folio: 3225 },
]

async function main() {
  console.log(dryRun ? '[dry-run]' : '[aplicar]', 'Corrección talón 3221–3226')

  if (dryRun) {
    console.log('Cancelar examen domingo 20923 →', FUERA + 20923)
    for (const id of MOVER_A_FUERA) console.log(`Temp pago ${id} → ${FUERA + id}`)
    for (const a of ASIGNAR) console.log(a.label)
    for (const c of CE_FOLIOS) console.log(`CE pago ${c.pagoId} folio → ${c.folio}`)
    return
  }

  const now = new Date().toISOString()

  const { error: err20923 } = await db
    .from('pago_interno')
    .update({
      pago_cancelado: 1,
      pago_folio: FUERA + 20923,
      pago_actualizacion: now,
    })
    .eq('pago_id', 20923)
  if (err20923) {
    console.error('Error cancelar 20923:', err20923.message)
    process.exit(1)
  }
  console.log('OK: examen domingo 20923 cancelado →', FUERA + 20923)

  for (const id of MOVER_A_FUERA) {
    if (id === 20923) continue
    const { error } = await db
      .from('pago_interno')
      .update({ pago_folio: FUERA + id, pago_actualizacion: now })
      .eq('pago_id', id)
    if (error) {
      console.error(`Error temp ${id}:`, error.message)
      process.exit(1)
    }
    console.log(`OK: temp ${id} → ${FUERA + id}`)
  }

  for (const a of ASIGNAR) {
    const { error } = await db
      .from('pago_interno')
      .update({ pago_folio: a.folio, pago_actualizacion: now })
      .eq('pago_id', a.pagoId)
    if (error) {
      console.error(`Error ${a.label}:`, error.message)
      process.exit(1)
    }
    console.log('OK:', a.label)
  }

  for (const c of CE_FOLIOS) {
    const { error } = await db
      .from('ce_tramite_administrativo')
      .update({ pago_folio: c.folio })
      .eq('pago_id', c.pagoId)
    if (error) {
      console.error(`Error CE ${c.pagoId}:`, error.message)
      process.exit(1)
    }
    console.log(`OK: CE pago ${c.pagoId} folio → ${c.folio}`)
  }

  const ids = [20913, 20922, 20923, 20925, 20928, 20929, 20930, 20931, 20932]
  const { data } = await db
    .from('pago_interno')
    .select('pago_id, pago_folio, pago_cancelado, alumno_id')
    .in('pago_id', ids)
    .order('pago_folio')

  console.log('\nVerificación pago_interno 3219–3227:')
  console.table(data)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
