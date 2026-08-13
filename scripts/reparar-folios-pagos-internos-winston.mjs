/**
 * Repara folios Winston general corruptos por el reinicio a 2671.
 *
 * Causa: al agotarse el techo artificial (2849) o al mezclar cuota en el máximo,
 * obtenerSiguienteFolioPago devolvía otra vez 2671 → MANUALES/CONSTANCIA duplicados.
 *
 * Reparación (Mario): a partir del MANUALES de ARVIZU (folio erróneo 2671),
 * reasignar autoincremental desde 2848 (MANUALES=2848, siguiente=2849, …).
 *
 *   node --env-file=.env.local scripts/reparar-folios-pagos-internos-winston.mjs --dry-run
 *   node --env-file=.env.local scripts/reparar-folios-pagos-internos-winston.mjs
 */
import { createAdminClient } from '@insforge/sdk'

const FOLIO_INICIO = 2848
const FOLIO_WINSTON_INICIAL = 2671
const FOLIO_WINSTON_TECHO = 26550
const CONCEPTOS_CUOTA = new Set([1, 2])
const CONCEPTO_MANUALES = 5

const dryRun = process.argv.includes('--dry-run')

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || process.env.INSFORGE_URL
const apiKey = process.env.INSFORGE_API_KEY
if (!baseUrl || !apiKey) {
  console.error('Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY')
  process.exit(1)
}

const db = createAdminClient({ baseUrl, apiKey }).database

async function fetchAllWinstonGeneral() {
  const pageSize = 1000
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('pago_interno')
      .select(
        'pago_id, alumno_id, concepto_id, concepto_otro, pago_folio, pago_importe, pago_fecha, pago_cancelado, pago_ciclo_escolar, pago_registro'
      )
      .gte('pago_folio', FOLIO_WINSTON_INICIAL)
      .lt('pago_folio', FOLIO_WINSTON_TECHO)
      .order('pago_fecha', { ascending: true })
      .order('pago_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return all.filter((p) => !CONCEPTOS_CUOTA.has(Number(p.concepto_id)))
}

async function resolveAlumnoArvizu(pagos) {
  const ids = [...new Set(pagos.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const pageSize = 200
  const match = []
  for (let i = 0; i < ids.length; i += pageSize) {
    const slice = ids.slice(i, i + pageSize)
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm')
      .in('alumno_id', slice)
    if (error) throw new Error(error.message)
    for (const a of data ?? []) {
      const nom = `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`
        .toUpperCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
      if (nom.includes('ARVIZU') && nom.includes('EDUARDO')) {
        match.push(a)
      }
    }
  }
  return match
}

const pagos = await fetchAllWinstonGeneral()
console.log(`Pagos Winston general en rango ${FOLIO_WINSTON_INICIAL}–${FOLIO_WINSTON_TECHO - 1}: ${pagos.length}`)

const alumnos = await resolveAlumnoArvizu(pagos)
if (alumnos.length === 0) {
  console.error('No se encontró alumno EDUARDO … ARVIZU')
  process.exit(1)
}
console.log(
  'Alumno(s):',
  alumnos.map((a) => `${a.alumno_id} ${a.alumno_ref} ${a.alumno_nombre} ${a.alumno_app} ${a.alumno_apm}`)
)
const alumnoIds = new Set(alumnos.map((a) => Number(a.alumno_id)))

const ancla = pagos.find(
  (p) =>
    alumnoIds.has(Number(p.alumno_id)) &&
    Number(p.concepto_id) === CONCEPTO_MANUALES &&
    Number(p.pago_folio) === 2671 &&
    Number(p.pago_cancelado) === 0
)

if (!ancla) {
  // Ya reparado u otro folio
  const manuales = pagos.filter(
    (p) =>
      alumnoIds.has(Number(p.alumno_id)) &&
      Number(p.concepto_id) === CONCEPTO_MANUALES &&
      Number(p.pago_cancelado) === 0
  )
  console.error('No hay MANUALES con folio 2671 para ARVIZU. Estado actual:')
  for (const m of manuales) {
    console.error(`  pago_id=${m.pago_id} folio=${m.pago_folio} fecha=${m.pago_fecha}`)
  }
  process.exit(manuales.some((m) => Number(m.pago_folio) === FOLIO_INICIO) ? 0 : 1)
}

console.log(
  `Ancla: pago_id=${ancla.pago_id} MANUALES folio ${ancla.pago_folio} → ${FOLIO_INICIO} fecha=${ancla.pago_fecha}`
)

// A partir del ancla (incluido): reasignar 2848, 2849, …
const aReparar = pagos.filter((p) => {
  if (Number(p.pago_cancelado) === 1) return false
  const fecha = String(p.pago_fecha ?? '')
  const anclaFecha = String(ancla.pago_fecha ?? '')
  if (fecha > anclaFecha) return true
  if (fecha < anclaFecha) return false
  return Number(p.pago_id) >= Number(ancla.pago_id)
})

aReparar.sort((a, b) => {
  const fa = String(a.pago_fecha ?? '')
  const fb = String(b.pago_fecha ?? '')
  if (fa !== fb) return fa < fb ? -1 : 1
  return Number(a.pago_id) - Number(b.pago_id)
})

console.log(`Pagos a renumerar desde ${FOLIO_INICIO}: ${aReparar.length}`)
const cambios = []
let folio = FOLIO_INICIO
for (const p of aReparar) {
  const actual = Number(p.pago_folio)
  if (actual !== folio) {
    cambios.push({
      pago_id: Number(p.pago_id),
      alumno_id: Number(p.alumno_id),
      concepto_id: Number(p.concepto_id),
      fecha: p.pago_fecha,
      de: actual,
      a: folio,
    })
  }
  folio += 1
}

console.log(`Cambios necesarios: ${cambios.length}`)
for (const c of cambios.slice(0, 40)) {
  console.log(
    `  pago_id=${c.pago_id} alumno=${c.alumno_id} concepto=${c.concepto_id} ${c.fecha}: ${c.de} → ${c.a}`
  )
}
if (cambios.length > 40) console.log(`  … y ${cambios.length - 40} más`)

if (dryRun) {
  console.log('Dry-run: sin escribir.')
  process.exit(0)
}

let ok = 0
let fail = 0
for (const c of cambios) {
  const { error } = await db
    .from('pago_interno')
    .update({ pago_folio: c.a })
    .eq('pago_id', c.pago_id)
  if (error) {
    console.error(`Fallo pago_id=${c.pago_id}:`, error.message)
    fail += 1
  } else {
    ok += 1
  }
}

console.log(`Listo. Actualizados=${ok} fallos=${fail}. Siguiente folio esperado=${folio}`)
process.exit(fail ? 1 : 0)
