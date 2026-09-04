/**
 * 2026-09-04 - Clave general de 8 dígitos (MD5) para Educativo + Primaria Winston.
 * NO toca secundaria (maestro_nivel = 4).
 *
 * Uso: node scripts/set-clave-general-educativo-primaria.mjs
 * Guarda el resultado en tmp/claves-educativo-primaria-8dig.json (no commitear).
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

function md5Hex(raw) {
  return createHash('md5').update(raw, 'utf8').digest('hex')
}

function n(v, fb = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : fb
}

async function main() {
  const plain = process.env.CLAVE_8 || String(randomInt(10000000, 100000000))
  if (!/^\d{8}$/.test(plain)) throw new Error('CLAVE_8 debe ser exactamente 8 dígitos')
  const hashed = md5Hex(plain)

  const { data: maestros, error } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm, maestro_email, maestro_nivel')
    .in('maestro_nivel', [1, 2, 3])
    .order('maestro_nivel')
    .order('maestro_usuario')
  if (error) throw new Error(error.message)

  const updated = []
  for (const m of maestros || []) {
    if (n(m.maestro_nivel) === 4) continue
    const { error: e2 } = await db
      .from('boleta_maestro')
      .update({ maestro_clave: hashed })
      .eq('maestro_id', m.maestro_id)
      .in('maestro_nivel', [1, 2, 3])
    if (e2) throw new Error(e2.message)
    updated.push({
      maestro_id: m.maestro_id,
      nivel: m.maestro_nivel,
      usuario: m.maestro_usuario,
      nombre: [m.maestro_nombre, m.maestro_app, m.maestro_apm].filter(Boolean).join(' '),
      email: m.maestro_email,
    })
  }

  const { data: sec } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_clave')
    .eq('maestro_nivel', 4)
    .limit(5)

  const out = {
    fecha: new Date().toISOString(),
    alcance: 'maestro_nivel 1–3 (Educativo maternal/kinder + Primaria Winston)',
    secundaria: 'NO TOCADA',
    clave_plana_8_digitos: plain,
    clave_md5: hashed,
    docentes_actualizados: updated.length,
    docentes: updated,
    secundaria_sample: sec || [],
  }
  const path = resolve(process.cwd(), 'tmp/claves-educativo-primaria-8dig.json')
  writeFileSync(path, JSON.stringify(out, null, 2))
  console.log(
    JSON.stringify(
      {
        clave: plain,
        actualizados: updated.length,
        secundaria_intacta: (sec || []).every((s) => s.maestro_clave !== hashed),
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
