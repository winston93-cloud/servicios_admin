#!/usr/bin/env node
/**
 * Sincroniza tabla `alumno` (roster operativo) desde Winston Servicios → InsForge Boletas.
 * Uso: node --env-file=.env.local scripts/sync-alumno-winston-a-boletas.mjs
 */
import { createAdminClient } from '@insforge/sdk'

const wUrl = process.env.INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_URL
const wKey =
  process.env.INSFORGE_API_KEY ||
  process.env.INSFORGE_SERVICE_ROLE_KEY ||
  process.env.INSFORGE_SERVICE_KEY
const bUrl = process.env.BOLETAS_INSFORGE_URL
const bKey = process.env.BOLETAS_INSFORGE_API_KEY

if (!wUrl || !wKey || !bUrl || !bKey) {
  console.error('Faltan env Winston (INSFORGE_*) o Boletas (BOLETAS_INSFORGE_*)')
  process.exit(1)
}

const COLS = [
  'alumno_id',
  'alumno_ref',
  'alumno_app',
  'alumno_apm',
  'alumno_nombre',
  'alumno_nivel',
  'alumno_grado',
  'alumno_grupo',
  'alumno_status',
  'alumno_nuevo_ingreso',
  'alumno_ciclo_escolar',
  'alumno_registro',
  'alumno_alta',
  'alumno_boleta',
  'mes',
  'secret_key',
  'motivo',
  'responsable',
  'estatus_key',
  'digito',
  'hijo',
]

function pick(row) {
  const out = {}
  for (const c of COLS) {
    if (row[c] !== undefined) out[c] = row[c]
  }
  // Defaults for NOT NULL cols that might be missing
  if (out.alumno_status == null) out.alumno_status = 1
  if (out.alumno_nuevo_ingreso == null) out.alumno_nuevo_ingreso = 0
  if (out.alumno_boleta == null) out.alumno_boleta = 0
  if (out.mes == null) out.mes = 0
  if (out.secret_key == null) out.secret_key = ''
  if (out.motivo == null) out.motivo = ''
  if (out.responsable == null) out.responsable = ''
  if (out.estatus_key == null) out.estatus_key = 0
  if (out.digito == null) out.digito = 0
  if (out.hijo == null) out.hijo = 0
  return out
}

async function fetchAll(db, ciclo) {
  const page = 1000
  let from = 0
  const all = []
  for (;;) {
    let q = db
      .from('alumno')
      .select(COLS.join(','))
      .order('alumno_id', { ascending: true })
      .range(from, from + page - 1)
    if (ciclo != null) q = q.eq('alumno_ciclo_escolar', ciclo)
    const { data, error } = await q
    if (error) throw new Error(error.message || JSON.stringify(error))
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < page) break
    from += page
  }
  return all
}

async function upsert(db, rows, chunkSize = 150) {
  let done = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map(pick)
    const { error } = await db.from('alumno').upsert(chunk)
    if (error) throw new Error(`upsert: ${error.message || JSON.stringify(error)}`)
    done += chunk.length
    process.stdout.write(`\r  upsert ${done}/${rows.length}`)
  }
  process.stdout.write('\n')
}

async function main() {
  const cicloArg = process.argv.find((a) => a.startsWith('--ciclo='))
  const ciclo = cicloArg ? Number(cicloArg.split('=')[1]) : null
  const winston = createAdminClient({ baseUrl: wUrl, apiKey: wKey })
  const boletas = createAdminClient({ baseUrl: bUrl, apiKey: bKey })

  console.log(
    ciclo != null
      ? `Leyendo alumnos Winston ciclo=${ciclo}…`
      : 'Leyendo alumnos Winston (todos los ciclos)…'
  )
  const rows = await fetchAll(winston.database, ciclo)
  console.log(`  ${rows.length} filas`)

  if (!rows.length) {
    console.error('Sin filas que sincronizar')
    process.exit(1)
  }

  console.log('Upsert en Boletas…')
  await upsert(boletas.database, rows)

  // Verificación rápida ciclo actual típico
  const checkCiclo = ciclo ?? 23
  const { count: k1a } = await boletas.database
    .from('alumno')
    .select('*', { count: 'exact', head: true })
    .eq('alumno_ciclo_escolar', checkCiclo)
    .eq('alumno_nivel', 2)
    .eq('alumno_grado', 1)
    .eq('alumno_grupo', 1)
    .in('alumno_status', [1, 4, 5])
  const { count: sec } = await boletas.database
    .from('alumno')
    .select('*', { count: 'exact', head: true })
    .eq('alumno_ciclo_escolar', checkCiclo)
    .eq('alumno_nivel', 4)
    .neq('alumno_status', 0)
  console.log(`OK. Verificación ciclo ${checkCiclo}: kinder K1·A activos=${k1a}, secundaria activos=${sec}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
