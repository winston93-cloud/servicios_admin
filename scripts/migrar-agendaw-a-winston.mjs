#!/usr/bin/env node
/**
 * Espejo AgendaW (InsForge sr6a9iza) → Winston Servicios.
 *
 *   node --env-file=.env.local scripts/migrar-agendaw-a-winston.mjs            # solo verifica
 *   node --env-file=.env.local scripts/migrar-agendaw-a-winston.mjs --copiar   # copia y verifica
 *
 * --copiar hace upsert por id de las filas nuevas o cambiadas en AgendaW.
 * --borrar-sobrantes además borra en Winston lo que ya no existe en AgendaW; usarlo SOLO antes
 * del corte (después, Winston recibe citas nuevas que AgendaW no tiene).
 * En una segunda pasada, los triggers de updated_at reescribirían esa columna al actualizar:
 * desactivarlos antes (ALTER TABLE … DISABLE TRIGGER trg_…_updated_at) y reactivarlos después.
 * Tras copiar, ajustar la secuencia: SELECT setval('agendaw_wsp_id_seq', max(id)) FROM agendaw_wsp.
 */
import { readFileSync } from 'node:fs'
import { createAdminClient } from '@insforge/sdk'

const AGENDAW_PROJECT = '/home/mario/Proyectos/agendaw/.insforge/project.json'

/** Orden de inserción (padres primero por las FK a admission_appointments). */
const TABLAS = [
  { origen: 'admission_appointments', destino: 'admission_appointments' },
  { origen: 'admission_schedules', destino: 'admission_schedules' },
  { origen: 'blocked_dates', destino: 'blocked_dates' },
  { origen: 'tour_recorridos', destino: 'tour_recorridos' },
  { origen: 'wsp', destino: 'agendaw_wsp' },
  { origen: 'admission_permission_requests', destino: 'admission_permission_requests' },
  { origen: 'expediente_inicial', destino: 'expediente_inicial' },
]

const copiar = process.argv.includes('--copiar')
const borrarSobrantes = process.argv.includes('--borrar-sobrantes')

const agendawCfg = JSON.parse(readFileSync(AGENDAW_PROJECT, 'utf8'))
const origen = createAdminClient({ baseUrl: agendawCfg.oss_host, apiKey: agendawCfg.api_key }).database

const winstonUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL
const winstonKey = process.env.INSFORGE_API_KEY
if (!winstonUrl || !winstonKey) throw new Error('Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY (.env.local de Winston).')
if (winstonUrl.includes('sr6a9iza')) throw new Error('El destino apunta a AgendaW; debe ser Winston Servicios.')
const destino = createAdminClient({ baseUrl: winstonUrl, apiKey: winstonKey }).database

async function todas(db, tabla) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select('*').order('id', { ascending: true }).range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) return filas
  }
}

const normal = (fila) => JSON.stringify(Object.keys(fila).sort().map((k) => [k, fila[k]]))

async function verificar() {
  let ok = true
  for (const t of TABLAS) {
    const [a, w] = await Promise.all([todas(origen, t.origen), todas(destino, t.destino)])
    const mapaW = new Map(w.map((f) => [String(f.id), normal(f)]))
    const faltan = a.filter((f) => !mapaW.has(String(f.id))).length
    const distintas = a.filter((f) => mapaW.has(String(f.id)) && mapaW.get(String(f.id)) !== normal(f)).length
    const idsA = new Set(a.map((f) => String(f.id)))
    const sobran = w.filter((f) => !idsA.has(String(f.id))).length
    const bien = faltan === 0 && distintas === 0 && sobran === 0
    if (!bien) ok = false
    console.log(`${bien ? 'OK ' : 'DIF'} ${t.origen.padEnd(30)} AgendaW=${a.length} Winston=${w.length} faltan=${faltan} distintas=${distintas} sobran=${sobran}`)
  }
  return ok
}

if (copiar) {
  for (const t of TABLAS) {
    const actuales = new Map((await todas(destino, t.destino)).map((f) => [String(f.id), normal(f)]))
    const filas = (await todas(origen, t.origen)).filter((f) => actuales.get(String(f.id)) !== normal(f))
    for (let i = 0; i < filas.length; i += 200) {
      const lote = filas.slice(i, i + 200)
      const { error } = await destino.from(t.destino).upsert(lote, { onConflict: 'id' })
      if (error) throw new Error(`${t.destino}: ${error.message}`)
    }
    console.log(`copiadas ${t.origen} → ${t.destino}: ${filas.length}`)
  }
  for (const t of borrarSobrantes ? [...TABLAS].reverse() : []) {
    const ids = new Set((await todas(origen, t.origen)).map((f) => String(f.id)))
    const sobran = (await todas(destino, t.destino)).filter((f) => !ids.has(String(f.id))).map((f) => f.id)
    if (sobran.length) {
      const { error } = await destino.from(t.destino).delete().in('id', sobran)
      if (error) throw new Error(`${t.destino} (borrar sobrantes): ${error.message}`)
      console.log(`borradas en Winston ${t.destino}: ${sobran.length} (ya no existen en AgendaW)`)
    }
  }
}

const ok = await verificar()
console.log(ok ? '\nESPEJO IDÉNTICO' : '\nHAY DIFERENCIAS')
process.exit(ok ? 0 : 1)
