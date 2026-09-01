#!/usr/bin/env node
/**
 * Alinea folios 3220–3222 con talón físico (31-ago / 1-sep 2026):
 * - Cancela reimpresiones Martínez domingo (20914, 20916) → fuera de talón
 * - Helen 20922: 3222 → 3220
 * - Viktor 20925: 3224 → 3221
 * - Diego 20928: 3225 → 3222
 * - CE: cancela trámites Martínez; actualiza folio Diego
 *
 * Uso: node scripts/corregir-folios-talon-3220-3222.mjs [--dry-run]
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

const steps = [
  {
    label: 'Cancelar Ana Martínez pago 20914 (folio 3220)',
    run: () =>
      db
        .from('pago_interno')
        .update({
          pago_cancelado: 1,
          pago_folio: FUERA + 20914,
          pago_actualizacion: new Date().toISOString(),
        })
        .eq('pago_id', 20914),
  },
  {
    label: 'Cancelar Luis Martínez pago 20916 (folio 3221)',
    run: () =>
      db
        .from('pago_interno')
        .update({
          pago_cancelado: 1,
          pago_folio: FUERA + 20916,
          pago_actualizacion: new Date().toISOString(),
        })
        .eq('pago_id', 20916),
  },
  {
    label: 'Temp Diego 20928 3225→920928',
    run: () =>
      db.from('pago_interno').update({ pago_folio: FUERA + 20928 }).eq('pago_id', 20928),
  },
  {
    label: 'Temp Viktor 20925 3224→920925',
    run: () =>
      db.from('pago_interno').update({ pago_folio: FUERA + 20925 }).eq('pago_id', 20925),
  },
  {
    label: 'Temp Helen 20922 3222→920922',
    run: () =>
      db.from('pago_interno').update({ pago_folio: FUERA + 20922 }).eq('pago_id', 20922),
  },
  {
    label: 'Helen 20922 → folio 3220',
    run: () => db.from('pago_interno').update({ pago_folio: 3220 }).eq('pago_id', 20922),
  },
  {
    label: 'Viktor 20925 → folio 3221',
    run: () => db.from('pago_interno').update({ pago_folio: 3221 }).eq('pago_id', 20925),
  },
  {
    label: 'Diego 20928 → folio 3222',
    run: () => db.from('pago_interno').update({ pago_folio: 3222 }).eq('pago_id', 20928),
  },
  {
    label: 'CE trámite cancelar Martínez pendientes (20914, 20916)',
    run: () =>
      db
        .from('ce_tramite_administrativo')
        .update({ estado: 'cancelado' })
        .in('pago_id', [20914, 20916])
        .eq('estado', 'pendiente'),
  },
  {
    label: 'CE trámite Diego folio 3225→3222',
    run: () =>
      db
        .from('ce_tramite_administrativo')
        .update({ pago_folio: 3222 })
        .eq('pago_id', 20928),
  },
]

async function main() {
  console.log(dryRun ? '[dry-run]' : '[aplicar]', 'Corrección talón 3219–3222')
  if (dryRun) {
    for (const s of steps) console.log(' -', s.label)
    return
  }
  for (const s of steps) {
    const { error } = await s.run()
    if (error) {
      console.error('Error en:', s.label, error.message)
      process.exit(1)
    }
    console.log('OK:', s.label)
  }

  const { data } = await db
    .from('pago_interno')
    .select('pago_id, pago_folio, pago_cancelado, alumno_id')
    .in('pago_id', [20913, 20914, 20916, 20922, 20923, 20925, 20928])
    .order('pago_folio')

  console.log('\nVerificación pago_interno:')
  console.table(data)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
