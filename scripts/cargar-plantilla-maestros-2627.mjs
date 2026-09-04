/**
 * 2026-09-04 - Carga plantilla ES/EN Educativo (maternal/kinder) + Winston primaria
 * y actualiza correos institucionales de secundaria.
 *
 * Fuente: tmp/titulares-es-en-2627.json (generado del Excel estadístico 26-27).
 * Uso: node scripts/cargar-plantilla-maestros-2627.mjs
 */
import { createClient } from '@insforge/sdk'
import { createHash, randomInt } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim().replace(/:$/, ''), l.slice(i + 1).trim()]
    })
)

const client = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.INSFORGE_API_KEY,
})
const db = client.database

const DATA = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/data/titulares-es-en-2627.json'), 'utf8')
)
const SLOT_ES = { nombre: 'Maestro(a)', orden: 1 }
const SLOT_EN = { nombre: 'Teacher', orden: 2 }

function n(v, fb = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : fb
}

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function md5Hex(raw) {
  return createHash('md5').update(raw, 'utf8').digest('hex')
}

/** Educativo/primaria: guarda MD5 de 8 dígitos. Secundaria no usa este flujo de altas. */
function claveNueva() {
  return md5Hex(String(randomInt(10000000, 100000000)))
}

function splitNombre(full) {
  const parts = String(full || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
  if (parts.length <= 1) return { nombre: parts[0] || 'DOCENTE', app: parts[0] || 'DOCENTE', apm: null }
  if (parts.length === 2) return { nombre: parts[0], app: parts[1], apm: null }
  return {
    nombre: parts.slice(0, -2).join(' '),
    app: parts.at(-2),
    apm: parts.at(-1),
  }
}

function usuarioDesdeCorreo(correo, fallbackNombre) {
  const local = String(correo || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
  if (local && local.length >= 3 && local.length <= 40) return local.slice(0, 40)
  const base = stripAccents(fallbackNombre || 'docente')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
  return base || 'docente'
}

function overlapNombre(a, b) {
  const ta = new Set(a.split(' ').filter((x) => x.length > 2))
  const tb = b.split(' ').filter((x) => x.length > 2)
  let hit = 0
  for (const t of tb) if (ta.has(t)) hit++
  return hit >= 2
}

async function nextId(tabla, col) {
  const { data } = await db.from(tabla).select(col).order(col, { ascending: false }).limit(1)
  return n(data?.[0]?.[col], 0) + 1
}

async function asegurarSlot(nivel, grado, slot) {
  const { data: existente } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_nivel, materia_grado, materia_orden')
    .eq('materia_nivel', nivel)
    .eq('materia_grado', grado)
    .eq('materia_orden', slot.orden)
    .maybeSingle()
  if (existente) return existente

  const id = await nextId('boleta_materia', 'materia_id')
  const payload = {
    materia_id: id,
    materia_nombre: slot.nombre,
    materia_nivel: nivel,
    materia_grado: grado,
    materia_orden: slot.orden,
  }
  const { error } = await db.from('boleta_materia').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

async function main() {
  const titulares = DATA.titulares || []
  const correosSec = DATA.correosSec || {}
  console.log(`Titulares ES/EN a cargar: ${titulares.length}`)
  console.log(`Correos secundaria en Excel: ${Object.keys(correosSec).length}`)

  const { data: existentes, error: e1 } = await db
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm, maestro_email, maestro_nivel, maestro_clave'
    )
  if (e1) throw new Error(e1.message)

  const lista = existentes || []
  const byUser = new Map(lista.map((m) => [String(m.maestro_usuario).toLowerCase(), m]))
  let nextMaestroId = Math.max(0, ...lista.map((m) => n(m.maestro_id)), 0) + 1

  const log = { altas: [], reusados: [], asignaciones: [], emailsSec: [], errores: [] }

  for (const t of titulares) {
    const parts = splitNombre(t.nombre)
    let usuario = usuarioDesdeCorreo(t.correo, parts.nombre)
    let maestro = byUser.get(usuario)

    if (maestro && n(maestro.maestro_nivel, 4) !== t.maestroNivel) {
      usuario = `${usuario}.n${t.maestroNivel}`.slice(0, 40)
      maestro = byUser.get(usuario)
    }

    if (!maestro) {
      maestro = lista.find(
        (m) =>
          String(m.maestro_email || '').toLowerCase() === t.correo &&
          n(m.maestro_nivel, 4) === t.maestroNivel
      )
    }

    if (!maestro) {
      const id = nextMaestroId++
      const row = {
        maestro_id: id,
        maestro_app: parts.app,
        maestro_apm: parts.apm,
        maestro_nombre: parts.nombre,
        maestro_usuario: usuario,
        maestro_clave: claveNueva(),
        maestro_email: t.correo,
        maestro_sexo: 0,
        maestro_nivel: t.maestroNivel,
      }
      const { error } = await db.from('boleta_maestro').insert([row])
      if (error) {
        log.errores.push({ fase: 'alta', usuario, error: error.message })
        continue
      }
      maestro = row
      byUser.set(usuario, row)
      lista.push(row)
      log.altas.push({ id, usuario, email: t.correo, nivel: t.maestroNivel, nombre: t.nombre })
    } else {
      const { error } = await db
        .from('boleta_maestro')
        .update({
          maestro_email: t.correo,
          maestro_nombre: parts.nombre,
          maestro_app: parts.app,
          maestro_apm: parts.apm,
          maestro_nivel: t.maestroNivel,
        })
        .eq('maestro_id', maestro.maestro_id)
      if (error) log.errores.push({ fase: 'update', id: maestro.maestro_id, error: error.message })
      else log.reusados.push({ id: maestro.maestro_id, usuario: maestro.maestro_usuario, email: t.correo })
    }

    const slot = t.idioma === 'es' ? SLOT_ES : SLOT_EN
    for (const grado of t.grados) {
      const mat = await asegurarSlot(t.maestroNivel, grado, slot)
      for (const letra of t.letras) {
        const { data: prev } = await db
          .from('boleta_maestro_grupo')
          .select('grupo_id, maestro_id')
          .eq('materia_id', mat.materia_id)
          .eq('grupo_letra', letra)
          .maybeSingle()

        if (prev && n(prev.maestro_id) === n(maestro.maestro_id)) {
          log.asignaciones.push({
            ok: true,
            skip: true,
            materia_id: mat.materia_id,
            letra,
            maestro_id: maestro.maestro_id,
          })
          continue
        }

        const grupoId = prev ? n(prev.grupo_id) : await nextId('boleta_maestro_grupo', 'grupo_id')
        const payload = {
          grupo_id: grupoId,
          maestro_id: n(maestro.maestro_id),
          materia_id: n(mat.materia_id),
          grupo_letra: letra,
        }
        const { error } = await db.from('boleta_maestro_grupo').upsert([payload])
        if (error) log.errores.push({ fase: 'asig', payload, error: error.message })
        else
          log.asignaciones.push({
            ok: true,
            ...payload,
            grado,
            nivel: t.maestroNivel,
            idioma: t.idioma,
          })
      }
    }
  }

  const byUserMail = {
    jaqueline: 'lenguamaterna.m2@winston93.edu.mx',
    marta: 'cienciasexactas.m1@winston93.edu.mx',
    orlando: 'cienciasexactas.m4@winston93.edu.mx',
    Reyes: 'civismo.m1@winston93.edu.mx',
    karla: 'idiomas@winston93.edu.mx',
    leslie: 'idiomas@winston93.edu.mx',
    cristina: 'lenguamaterna.m1@winston93.edu.mx',
    melissa: 'emprendimiento@winston93.edu.mx',
    jenifer: 'tecnologia.m2@winston93.edu.mx',
    ingrid: 'roboticasec.m1@winston93.edu.mx',
    dinorah: 'mindfulness@winston93.edu.mx',
    rosa: 'idiomas@winston93.edu.mx',
    noe: 'deportes.m1@winston93.edu.mx',
    amfl: 'artes.m1@winston93.edu.mx',
    Mirna: 'formacionsocial.m1@winston93.edu.mx',
    lion: 'idiomas@winston93.edu.mx',
  }

  for (const m of lista) {
    if (n(m.maestro_nivel, 4) !== 4) continue
    const full = stripAccents([m.maestro_nombre, m.maestro_app, m.maestro_apm].filter(Boolean).join(' '))
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim()
    let hit = byUserMail[String(m.maestro_usuario)] || null
    if (!hit) {
      for (const [k, correo] of Object.entries(correosSec)) {
        const key = stripAccents(k).toUpperCase().replace(/\s+/g, ' ')
        if (full && (key.includes(full) || full.includes(key) || overlapNombre(full, key))) {
          hit = correo
          break
        }
      }
    }
    if (!hit) continue
    if (String(m.maestro_email || '').toLowerCase() === hit) continue
    const { error } = await db.from('boleta_maestro').update({ maestro_email: hit }).eq('maestro_id', m.maestro_id)
    if (error) log.errores.push({ fase: 'email-sec', id: m.maestro_id, error: error.message })
    else log.emailsSec.push({ id: m.maestro_id, usuario: m.maestro_usuario, email: hit })
  }

  const outPath = resolve(process.cwd(), 'tmp/cargar-plantilla-maestros-2627-result.json')
  writeFileSync(outPath, JSON.stringify(log, null, 2))
  console.log(
    JSON.stringify(
      {
        altas: log.altas.length,
        reusados: log.reusados.length,
        asignaciones: log.asignaciones.filter((a) => a.ok && !a.skip).length,
        asignacionesSkip: log.asignaciones.filter((a) => a.skip).length,
        emailsSec: log.emailsSec.length,
        errores: log.errores.length,
        outPath,
      },
      null,
      2
    )
  )
  if (log.errores.length) console.error(log.errores.slice(0, 15))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
