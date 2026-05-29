#!/usr/bin/env node
/**
 * Importa pago_boucher_precio desde MySQL legacy a Supabase.
 * Ejecutar antes: sql/pago_boucher_precio_add.sql en el SQL Editor.
 *
 * node scripts/import-pago-boucher-precio-supabase.mjs
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8')
  const get = (k) => (raw.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
  const url = get('NEXT_PUBLIC_SUPABASE_URL')
  const key = get('SUPABASE_SERVICE_ROLE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !key) throw new Error('Faltan URL o clave Supabase en .env.local')
  return {
    url,
    key,
    mysql: {
      host: get('MYSQL_HOST'),
      port: get('MYSQL_PORT') || '3306',
      user: get('MYSQL_USER'),
      password: get('MYSQL_PASSWORD'),
      database: get('MYSQL_DATABASE'),
    },
  }
}

function leerDesdeMysql(mysql) {
  const cols =
    'precio_id,alumno_nivel,precio_inscripcion,precio_material,precio_seguro,precio_cuota_padres,precio_agosto,precio_colegiatura,precio_colegiatura2,precio_cambridge,precio_dtitulacion,descuento_cambio_nivel,descuento_cambio_grado,precio_ciclo_escolar'
  const cmd =
    `mysql -h ${mysql.host} -P ${mysql.port} -u ${mysql.user} -p${mysql.password} ${mysql.database} ` +
    `-N -B -e "SELECT ${cols} FROM pago_boucher_precio ORDER BY precio_id"`
  const tsv = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const rows = []
  for (const line of tsv.split('\n').filter(Boolean)) {
    const c = line.split('\t')
    rows.push({
      precio_id: Number(c[0]),
      alumno_nivel: Number(c[1]),
      precio_inscripcion: Number(c[2]),
      precio_material: Number(c[3]),
      precio_seguro: Number(c[4]),
      precio_cuota_padres: Number(c[5]),
      precio_agosto: Number(c[6]),
      precio_colegiatura: Number(c[7]),
      precio_colegiatura2: Number(c[8]),
      precio_cambridge: Number(c[9]),
      precio_dtitulacion: Number(c[10]),
      descuento_cambio_nivel: Number(c[11]),
      descuento_cambio_grado: Number(c[12]),
      precio_ciclo_escolar: Number(c[13]),
    })
  }
  return rows
}

async function ensureTabla(sb) {
  const { error } = await sb.from('pago_boucher_precio').select('*').limit(0)
  if (error?.code === '42P01') {
    console.error(
      'La tabla public.pago_boucher_precio no existe.\n' +
        'Ejecuta sql/pago_boucher_precio_add.sql en Supabase y vuelve a correr este script.'
    )
    process.exit(1)
  }
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

const { url, key, mysql } = loadEnv()
const sb = createClient(url, key, { auth: { persistSession: false } })

await ensureTabla(sb)

console.log('Leyendo pago_boucher_precio desde MySQL…')
const filas = leerDesdeMysql(mysql)
console.log('Registros:', filas.length)

for (let i = 0; i < filas.length; i += 100) {
  const lote = filas.slice(i, i + 100)
  const { error } = await sb.from('pago_boucher_precio').upsert(lote, { onConflict: 'precio_id' })
  if (error) throw new Error(`Upsert filas ${i + 1}: ${error.message}`)
}

console.log('Listo.')
