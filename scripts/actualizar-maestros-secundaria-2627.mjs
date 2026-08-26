/**
 * 2026-08-26 - Alta maestros nuevos + reasignación boleta_maestro_grupo
 * según matriz "CLASES IMPARTIDAS POR MAESTROS 26-27" (secundaria).
 *
 * Uso: node scripts/actualizar-maestros-secundaria-2627.mjs
 * Requiere .env.local con NEXT_PUBLIC_INSFORGE_URL + INSFORGE_API_KEY
 * (mismo proyecto Winston Servicios).
 */
import { createClient } from '@insforge/sdk'
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

function claveNueva(usuario, apellido) {
  const ini = String(apellido || usuario)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z]/g, '')
    .charAt(0)
    .toUpperCase()
  return `Winston26${ini || 'X'}`
}

const NUEVOS = [
  {
    app: 'CASTILLO',
    apm: null,
    nombre: 'CRISTINA',
    usuario: 'cristina',
  },
  {
    app: 'VICENCIO',
    apm: null,
    nombre: 'LESLIE',
    usuario: 'leslie',
  },
  {
    app: 'LOPEZ',
    apm: null,
    nombre: 'JENIFER LIZBETH',
    usuario: 'jenifer',
  },
  {
    app: 'MEJIA',
    apm: 'FLORES',
    nombre: 'INGRID',
    usuario: 'ingrid',
  },
  {
    app: 'ROMERO',
    apm: null,
    nombre: 'ROSA',
    usuario: 'rosa',
  },
  {
    app: 'LERMA',
    apm: null,
    nombre: 'DINORAH',
    usuario: 'dinorah',
  },
]

/** materia_id por clave lógica grado 1|2|3 */
const M = {
  esp: { 1: 1, 2: 2, 3: 3 },
  cie: { 1: 7, 2: 43, 3: 9 },
  mat: { 1: 4, 2: 5, 3: 6 },
  ing: { 1: 52, 2: 37, 3: 38 },
  his: { 1: 25, 2: 39, 3: 44 },
  geo: { 1: 24 },
  civ: { 1: 22, 2: 23, 3: 26 },
  art: { 1: 10, 2: 11, 3: 12 },
  edf: { 1: 19, 2: 20, 3: 21 },
  tec: { 1: 16, 2: 17, 3: 18 },
  emp: { 1: 53, 2: 54, 3: 55 },
  rob: { 1: 48, 2: 49, 3: 50 },
  fra: { 1: 27, 2: 28, 3: 29 },
  fsh: { 1: 13, 2: 14, 3: 15 },
  mind: { 1: 45, 2: 46, 3: 47 },
}

function letras(grupos) {
  return [...grupos].sort().join('')
}

async function main() {
  const { data: existentes, error: e1 } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm')
  if (e1) throw new Error(e1.message)

  const byUser = new Map(
    (existentes || []).map((m) => [String(m.maestro_usuario).toLowerCase(), m])
  )
  const find = (pred) => (existentes || []).find(pred)

  const ids = {
    jaqueline: find((m) => Number(m.maestro_id) === 34)?.maestro_id,
    cristina: null,
    lizzeth: find((m) => Number(m.maestro_id) === 42)?.maestro_id,
    orlando: find((m) => Number(m.maestro_id) === 55)?.maestro_id,
    martha: find((m) => Number(m.maestro_id) === 41)?.maestro_id,
    karla: find((m) => Number(m.maestro_id) === 50)?.maestro_id,
    leslie: null,
    meighlyng: find((m) => Number(m.maestro_id) === 11)?.maestro_id,
    ana: find((m) => Number(m.maestro_id) === 31)?.maestro_id,
    noe: find((m) => Number(m.maestro_id) === 25)?.maestro_id,
    jenifer: null,
    ingrid: null,
    melissa: find((m) => Number(m.maestro_id) === 51)?.maestro_id,
    rosa: null,
    mirna: find((m) => Number(m.maestro_id) === 6)?.maestro_id,
    dinorah: null,
  }

  for (const k of Object.keys(ids)) {
    if (ids[k] == null && byUser.has(k)) ids[k] = byUser.get(k).maestro_id
  }

  const { data: maxRow } = await db
    .from('boleta_maestro')
    .select('maestro_id')
    .order('maestro_id', { ascending: false })
    .limit(1)
  let nextId = Number(maxRow?.[0]?.maestro_id || 55) + 1

  const credencialesNuevas = []
  const hoy = new Date().toISOString().slice(0, 10)

  for (const n of NUEVOS) {
    const u = n.usuario.toLowerCase()
    if (byUser.has(u)) {
      ids[u] = byUser.get(u).maestro_id
      console.log(`Ya existe maestro usuario=${u} id=${ids[u]}`)
      continue
    }
    const clave = claveNueva(u, n.app)
    const row = {
      maestro_id: nextId,
      maestro_app: n.app,
      maestro_apm: n.apm,
      maestro_nombre: n.nombre,
      maestro_usuario: u,
      maestro_clave: clave,
      maestro_registro: hoy,
    }
    const { error } = await db.from('boleta_maestro').insert([row])
    if (error) throw new Error(`Alta ${u}: ${error.message}`)
    ids[u] = nextId
    credencialesNuevas.push({
      nombre: [n.nombre, n.app, n.apm].filter(Boolean).join(' '),
      usuario: u,
      clave,
      maestro_id: nextId,
    })
    console.log(`Alta OK id=${nextId} usuario=${u}`)
    nextId += 1
  }

  // Mapear aliases
  ids.cristina = ids.cristina || ids.cristina
  // ensure required
  const required = [
    'jaqueline',
    'cristina',
    'lizzeth',
    'orlando',
    'martha',
    'karla',
    'leslie',
    'meighlyng',
    'ana',
    'noe',
    'jenifer',
    'ingrid',
    'melissa',
    'rosa',
    'mirna',
    'dinorah',
  ]
  for (const k of required) {
    if (!ids[k]) throw new Error(`Falta resolver maestro: ${k}`)
  }

  // Borrar asignaciones secundarias actuales
  const { data: mats } = await db
    .from('boleta_materia')
    .select('materia_id')
    .eq('materia_nivel', 4)
  const matIds = (mats || []).map((m) => Number(m.materia_id))
  if (!matIds.length) throw new Error('Sin materias nivel 4')

  const { data: oldGrupos, error: eg } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id, materia_id')
    .in('materia_id', matIds)
  if (eg) throw new Error(eg.message)
  const oldIds = (oldGrupos || []).map((g) => Number(g.grupo_id))
  console.log(`Asignaciones secundarias previas: ${oldIds.length}`)
  if (oldIds.length) {
    // borrar por lotes
    for (let i = 0; i < oldIds.length; i += 50) {
      const chunk = oldIds.slice(i, i + 50)
      const { error } = await db.from('boleta_maestro_grupo').delete().in('grupo_id', chunk)
      if (error) throw new Error(`Delete grupos: ${error.message}`)
    }
  }

  const { data: maxG } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id')
    .order('grupo_id', { ascending: false })
    .limit(1)
  let gid = Number(maxG?.[0]?.grupo_id || 224) + 1

  /** @type {{maestro: string, grado: number, letras: string, matKey: keyof typeof M}[]} */
  const plan = [
    // Español
    { maestro: 'jaqueline', matKey: 'esp', grado: 1, letras: 'AC' },
    { maestro: 'jaqueline', matKey: 'esp', grado: 2, letras: 'AB' },
    { maestro: 'jaqueline', matKey: 'esp', grado: 3, letras: 'ABC' },
    { maestro: 'cristina', matKey: 'esp', grado: 1, letras: 'B' },
    // Ciencias
    { maestro: 'lizzeth', matKey: 'cie', grado: 1, letras: 'AB' },
    { maestro: 'lizzeth', matKey: 'cie', grado: 2, letras: 'AB' },
    { maestro: 'lizzeth', matKey: 'cie', grado: 3, letras: 'ABC' },
    { maestro: 'orlando', matKey: 'cie', grado: 1, letras: 'C' },
    // Matemáticas
    { maestro: 'martha', matKey: 'mat', grado: 1, letras: 'BC' },
    { maestro: 'martha', matKey: 'mat', grado: 2, letras: 'AB' },
    { maestro: 'martha', matKey: 'mat', grado: 3, letras: 'ABC' },
    { maestro: 'cristina', matKey: 'mat', grado: 1, letras: 'A' },
    // Inglés
    { maestro: 'karla', matKey: 'ing', grado: 1, letras: 'A' },
    { maestro: 'karla', matKey: 'ing', grado: 2, letras: 'A' },
    { maestro: 'karla', matKey: 'ing', grado: 3, letras: 'A' },
    { maestro: 'leslie', matKey: 'ing', grado: 1, letras: 'BC' },
    { maestro: 'leslie', matKey: 'ing', grado: 2, letras: 'B' },
    { maestro: 'leslie', matKey: 'ing', grado: 3, letras: 'BC' },
    // Historia / Geo / Cívica
    { maestro: 'orlando', matKey: 'his', grado: 2, letras: 'AB' },
    { maestro: 'orlando', matKey: 'geo', grado: 1, letras: 'ABC' },
    { maestro: 'meighlyng', matKey: 'his', grado: 1, letras: 'ABC' },
    { maestro: 'meighlyng', matKey: 'his', grado: 3, letras: 'ABC' },
    { maestro: 'meighlyng', matKey: 'civ', grado: 1, letras: 'ABC' },
    { maestro: 'meighlyng', matKey: 'civ', grado: 2, letras: 'ABC' },
    { maestro: 'meighlyng', matKey: 'civ', grado: 3, letras: 'ABC' },
    // Artes / EdF
    { maestro: 'ana', matKey: 'art', grado: 1, letras: 'ABC' },
    { maestro: 'ana', matKey: 'art', grado: 2, letras: 'ABC' },
    { maestro: 'ana', matKey: 'art', grado: 3, letras: 'ABC' },
    { maestro: 'noe', matKey: 'edf', grado: 1, letras: 'ABC' },
    { maestro: 'noe', matKey: 'edf', grado: 2, letras: 'ABC' },
    { maestro: 'noe', matKey: 'edf', grado: 3, letras: 'ABC' },
    // Tecnología / Emprendimiento / Robótica
    { maestro: 'jenifer', matKey: 'tec', grado: 1, letras: 'ABC' },
    { maestro: 'ingrid', matKey: 'tec', grado: 2, letras: 'AB' },
    { maestro: 'melissa', matKey: 'tec', grado: 3, letras: 'ABC' },
    { maestro: 'melissa', matKey: 'emp', grado: 1, letras: 'ABC' },
    { maestro: 'melissa', matKey: 'emp', grado: 2, letras: 'ABC' },
    { maestro: 'melissa', matKey: 'emp', grado: 3, letras: 'ABC' },
    { maestro: 'ingrid', matKey: 'rob', grado: 1, letras: 'ABC' },
    { maestro: 'ingrid', matKey: 'rob', grado: 2, letras: 'ABC' },
    { maestro: 'ingrid', matKey: 'rob', grado: 3, letras: 'ABC' },
    // Francés / FSH / Mindfulness
    { maestro: 'rosa', matKey: 'fra', grado: 1, letras: 'ABC' },
    { maestro: 'rosa', matKey: 'fra', grado: 2, letras: 'ABC' },
    { maestro: 'rosa', matKey: 'fra', grado: 3, letras: 'ABC' },
    { maestro: 'mirna', matKey: 'fsh', grado: 1, letras: 'ABC' },
    { maestro: 'mirna', matKey: 'fsh', grado: 2, letras: 'ABC' },
    { maestro: 'mirna', matKey: 'fsh', grado: 3, letras: 'ABC' },
    { maestro: 'dinorah', matKey: 'mind', grado: 1, letras: 'ABC' },
    { maestro: 'dinorah', matKey: 'mind', grado: 2, letras: 'ABC' },
    { maestro: 'dinorah', matKey: 'mind', grado: 3, letras: 'ABC' },
  ]

  const inserts = []
  for (const p of plan) {
    const materiaId = M[p.matKey][p.grado]
    if (!materiaId) throw new Error(`Sin materia ${p.matKey} grado ${p.grado}`)
    inserts.push({
      grupo_id: gid++,
      maestro_id: ids[p.maestro],
      materia_id: materiaId,
      grupo_letra: letras(p.letras),
      grupo_registro: hoy,
    })
  }

  for (let i = 0; i < inserts.length; i += 40) {
    const chunk = inserts.slice(i, i + 40)
    const { error } = await db.from('boleta_maestro_grupo').insert(chunk)
    if (error) throw new Error(`Insert grupos: ${error.message}`)
  }

  const outPath = resolve(
    process.cwd(),
    'scripts/.maestros-nuevos-secundaria-2627.json'
  )
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generados_en: new Date().toISOString(),
        patron_clave: 'Winston26 + inicial apellido paterno',
        nuevos: credencialesNuevas,
        asignaciones: inserts.length,
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  )

  console.log(`\nAsignaciones insertadas: ${inserts.length}`)
  console.log(`Credenciales nuevas: ${credencialesNuevas.length} → ${outPath}`)
  for (const c of credencialesNuevas) {
    console.log(`- ${c.nombre} | usuario: ${c.usuario} | clave: ${c.clave}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
