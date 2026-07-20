/**
 * ELIMINA (no devolución) pagos fantasma «Ingreso mid-ciclo» ($0)
 * creados por error en reinscritos (alumno_nuevo_ingreso = 0).
 *
 *   node --env-file=.env.local scripts/limpiar-previos-ingreso-fantasma.mjs
 *   node --env-file=.env.local scripts/limpiar-previos-ingreso-fantasma.mjs --dry-run
 *   node --env-file=.env.local scripts/limpiar-previos-ingreso-fantasma.mjs --solo-hoy-cuota=2026-07-20
 */
import { createAdminClient } from '@insforge/sdk'

const FORMA = 'Ingreso mid-ciclo'
const dryRun = process.argv.includes('--dry-run')
const soloHoyArg = process.argv.find((a) => a.startsWith('--solo-hoy-cuota='))
const fechaCuota = soloHoyArg?.slice('--solo-hoy-cuota='.length) || null

function parseRef(ref) {
  const d = String(ref ?? '').replace(/\D/g, '')
  if (d.length < 9) return null
  return { concepto: d.slice(5, 7), ciclo: Number(d.slice(7, 9)) }
}

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || process.env.INSFORGE_URL
const apiKey = process.env.INSFORGE_API_KEY
if (!baseUrl || !apiKey) {
  console.error('Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY')
  process.exit(1)
}

const db = createAdminClient({ baseUrl, apiKey }).database

/** Si --solo-hoy-cuota=YYYY-MM-DD, limita a alumnos que pagaron 00 ese día. */
async function alumnoIdsFiltro() {
  if (!fechaCuota) return null
  const { data, error } = await db
    .from('pago_detalle')
    .select('alumno_id, pago_referencia, pago_importe, pago_cancelado')
    .eq('pago_fecha', fechaCuota)
    .gt('pago_importe', 0)
    .limit(5000)
  if (error) throw new Error(error.message)
  const ids = new Set()
  for (const p of data ?? []) {
    const canc = Number(p.pago_cancelado)
    if (canc === 1 || canc === 2) continue
    const parsed = parseRef(p.pago_referencia)
    if (!parsed || parsed.concepto !== '00') continue
    ids.add(Number(p.alumno_id))
  }
  return ids
}

console.log(
  fechaCuota
    ? `Modo: solo papás con cuota 00 el ${fechaCuota}`
    : 'Modo: todos los reinscritos con fantasma mid-ciclo'
)

const filtroIds = await alumnoIdsFiltro()
if (filtroIds && filtroIds.size === 0) {
  console.log('Nadie pagó cuota 00 ese día.')
  process.exit(0)
}
if (filtroIds) console.log(`Alumnos con cuota 00: ${filtroIds.size}`)

// Fantasma mid-ciclo (incluye los que se marcaron devolución=2 por error previo)
const { data: fantasmas, error: errF } = await db
  .from('pago_detalle')
  .select(
    'pago_id, alumno_id, pago_referencia, pago_importe, pago_forma, pago_cancelado, pago_nombre'
  )
  .eq('pago_forma', FORMA)
  .eq('pago_importe', 0)
  .limit(5000)

if (errF) {
  console.error(errF)
  process.exit(1)
}

const candidatos = (fantasmas ?? []).filter((p) => {
  if (filtroIds && !filtroIds.has(Number(p.alumno_id))) return false
  // No borrar un 00 fantasma (no deberían existir; previos no crean 00)
  const parsed = parseRef(p.pago_referencia)
  if (parsed?.concepto === '00') return false
  return true
})

const alumnoIds = [...new Set(candidatos.map((p) => Number(p.alumno_id)))]
console.log(`Candidatos fantasma: ${candidatos.length} en ${alumnoIds.length} alumnos`)

if (alumnoIds.length === 0) {
  console.log('Nada que borrar.')
  process.exit(0)
}

// Solo reinscritos (nuevo ingreso sí puede tener mid-ciclo legítimo)
const reinscritos = new Set()
for (let i = 0; i < alumnoIds.length; i += 100) {
  const slice = alumnoIds.slice(i, i + 100)
  const { data: als, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nuevo_ingreso, alumno_app, alumno_nombre')
    .in('alumno_id', slice)
  if (error) {
    console.error(error)
    process.exit(1)
  }
  for (const a of als ?? []) {
    if (Number(a.alumno_nuevo_ingreso) === 0) {
      reinscritos.add(Number(a.alumno_id))
      console.log(
        `  reinscrito ${a.alumno_ref} id=${a.alumno_id} ${a.alumno_app} ${a.alumno_nombre}`
      )
    }
  }
}

const aBorrar = candidatos.filter((p) => reinscritos.has(Number(p.alumno_id)))
console.log(`A ELIMINAR: ${aBorrar.length} filas`)

if (dryRun) {
  console.log(
    'Dry-run. Ejemplos:',
    aBorrar.slice(0, 15).map((p) => ({ id: p.pago_id, ref: p.pago_referencia, canc: p.pago_cancelado }))
  )
  process.exit(0)
}

let borrados = 0
let fallos = 0
for (const p of aBorrar) {
  const { error } = await db.from('pago_detalle').delete().eq('pago_id', p.pago_id)
  if (error) {
    console.error('fail', p.pago_id, error.message)
    fallos += 1
  } else {
    borrados += 1
  }
}

console.log(`Eliminados: ${borrados}. Fallos: ${fallos}.`)
