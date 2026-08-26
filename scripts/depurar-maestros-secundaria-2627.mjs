/**
 * 2026-08-26 - Depuración plantilla secundaria tras observaciones del Excel.
 *
 * - Bajas (ya no laboran): anyela, irving, javier, lilian, ddr1, sofi, xochitl
 * - Elizabeth Gamez (eli) = misma persona que Melissa Gamez (melissa): se elimina el
 *   registro duplicado `eli`; se conserva `melissa` con sus clases 26-27.
 * - NO tocar: yoli (YOLANDA), lion (IDIOMAS / clave Karla)
 *
 * Uso: node scripts/depurar-maestros-secundaria-2627.mjs
 */
import { createClient } from '@insforge/sdk'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = Object.fromEntries(
  readFileSync(resolve('.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim().replace(/:$/, ''), l.slice(i + 1).trim()]
    })
)

const db = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.INSFORGE_API_KEY,
}).database

/** maestro_id confirmados en plantilla marcada */
const BAJAS_IDS = [54, 47, 53, 49, 24, 46, 52]
const ELI_DUPLICADO_ID = 8
const NO_TOCAR = new Set([37, 40]) // lion, yoli

async function main() {
  const { data: mats, error: em } = await db
    .from('boleta_materia')
    .select('materia_id')
    .eq('materia_nivel', 4)
  if (em) throw new Error(em.message)
  const matIds = (mats || []).map((m) => Number(m.materia_id))

  const borrarIds = [...BAJAS_IDS, ELI_DUPLICADO_ID]
  for (const id of borrarIds) {
    if (NO_TOCAR.has(id)) throw new Error(`Protegido: no borrar maestro_id=${id}`)
  }

  // Quitar cualquier grupo residual (secundaria u otro nivel)
  const { data: grupos, error: eg } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id, maestro_id, materia_id')
    .in('maestro_id', borrarIds)
  if (eg) throw new Error(eg.message)
  const grupoIds = (grupos || []).map((g) => Number(g.grupo_id))
  if (grupoIds.length) {
    for (let i = 0; i < grupoIds.length; i += 50) {
      const chunk = grupoIds.slice(i, i + 50)
      const { error } = await db.from('boleta_maestro_grupo').delete().in('grupo_id', chunk)
      if (error) throw new Error(`Delete grupos: ${error.message}`)
    }
    console.log(`Grupos eliminados: ${grupoIds.length}`)
  } else {
    console.log('Sin grupos residuales en bajas/eli')
  }

  const { data: before, error: eb } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm')
    .in('maestro_id', borrarIds)
  if (eb) throw new Error(eb.message)

  const { error: ed } = await db.from('boleta_maestro').delete().in('maestro_id', borrarIds)
  if (ed) throw new Error(`Delete maestros: ${ed.message}`)

  console.log('\nEliminados:')
  for (const m of before || []) {
    const nom = [m.maestro_nombre, m.maestro_app, m.maestro_apm].filter(Boolean).join(' ')
    const tag = Number(m.maestro_id) === ELI_DUPLICADO_ID ? ' (duplicado → Melissa)' : ' (baja)'
    console.log(`- id=${m.maestro_id} ${m.maestro_usuario} · ${nom}${tag}`)
  }

  const { data: keep } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app')
    .in('maestro_id', [...NO_TOCAR])
  console.log('\nIntactos (no tocar):')
  for (const m of keep || []) {
    console.log(`- id=${m.maestro_id} ${m.maestro_usuario} · ${[m.maestro_nombre, m.maestro_app].filter(Boolean).join(' ')}`)
  }

  const { data: melissa } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app')
    .eq('maestro_usuario', 'melissa')
    .maybeSingle()
  const { data: gMel } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id')
    .eq('maestro_id', melissa?.maestro_id ?? -1)
    .in('materia_id', matIds)
  console.log(
    `\nMelissa activa: id=${melissa?.maestro_id} usuario=${melissa?.maestro_usuario} grupos_sec=${gMel?.length ?? 0}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
