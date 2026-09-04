/**
 * Asigna claves únicas estilo legacy (ej. judSSyUCA2%m) a Educativo + Primaria.
 * No toca secundaria. Garantiza que no se repitan con ningún maestro de ningún nivel.
 *
 * Uso: node scripts/set-claves-unicas-educativo-primaria.mjs
 * Guarda mapeo en tmp/claves-unicas-educativo-primaria.json (no commitear).
 */
import { createClient } from '@insforge/sdk'
import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const db = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.INSFORGE_API_KEY,
}).database

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGIT = '23456789'
const SPECIAL = '%!#@$&*?'

function pick(alphabet) {
  return alphabet[randomBytes(1)[0] % alphabet.length]
}

function generarClave(used) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const chars = [
      pick(UPPER),
      pick(LOWER),
      pick(LOWER),
      pick(UPPER),
      pick(UPPER),
      pick(LOWER),
      pick(DIGIT),
      pick(UPPER),
      pick(DIGIT),
      pick(SPECIAL),
      pick(LOWER),
      pick(LOWER),
    ]
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomBytes(1)[0] % (i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    const clave = chars.join('')
    if (!used.has(clave)) return clave
  }
  throw new Error('No se pudo generar clave única')
}

async function main() {
  const { data: todos, error } = await db
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm, maestro_email, maestro_nivel, maestro_clave'
    )
  if (error) throw new Error(error.message)

  const used = new Set((todos || []).map((m) => String(m.maestro_clave || '')).filter(Boolean))
  const objetivo = (todos || []).filter((m) => [1, 2, 3].includes(Number(m.maestro_nivel)))

  const mapping = []
  for (const m of objetivo) {
    if (m.maestro_clave) used.delete(String(m.maestro_clave))
    const clave = generarClave(used)
    used.add(clave)
    const { error: e2 } = await db
      .from('boleta_maestro')
      .update({ maestro_clave: clave })
      .eq('maestro_id', m.maestro_id)
      .in('maestro_nivel', [1, 2, 3])
    if (e2) throw new Error(e2.message)
    mapping.push({
      maestro_id: m.maestro_id,
      nivel: m.maestro_nivel,
      usuario: m.maestro_usuario,
      nombre: [m.maestro_nombre, m.maestro_app, m.maestro_apm].filter(Boolean).join(' '),
      email: m.maestro_email,
      clave,
    })
  }

  const { data: check } = await db.from('boleta_maestro').select('maestro_id, maestro_clave, maestro_nivel')
  const claves = (check || []).map((m) => m.maestro_clave).filter(Boolean)
  const path = resolve(process.cwd(), 'tmp/claves-unicas-educativo-primaria.json')
  writeFileSync(path, JSON.stringify({ fecha: new Date().toISOString(), docentes: mapping }, null, 2))

  console.log(
    JSON.stringify(
      {
        actualizados: mapping.length,
        clavesUnicasGlobales: new Set(claves).size === claves.length,
        secundariaIntacta: (check || [])
          .filter((m) => Number(m.maestro_nivel) === 4)
          .every((s) => !mapping.some((x) => x.maestro_id === s.maestro_id)),
        path,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
