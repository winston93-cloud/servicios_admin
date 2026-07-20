/**
 * Anula pagos fantasma «Ingreso mid-ciclo» ($0) generados por error a reinscritos
 * que hoy pagaron la cuota de inicio de curso (concepto 00).
 *
 * Uso:
 *   node --env-file=.env.local scripts/limpiar-previos-ingreso-fantasma.mjs
 *   node --env-file=.env.local scripts/limpiar-previos-ingreso-fantasma.mjs --fecha=2026-07-20
 */
import { createAdminClient } from '@insforge/sdk'

const FORMA = 'Ingreso mid-ciclo'
const fechaArg = process.argv.find((a) => a.startsWith('--fecha='))
const fechaHoy = fechaArg?.slice('--fecha='.length) || new Date().toISOString().slice(0, 10)
const dryRun = process.argv.includes('--dry-run')

function parseRef(ref) {
  const d = String(ref ?? '').replace(/\D/g, '')
  if (d.length < 9) return null
  return {
    concepto: d.slice(5, 7),
    ciclo: Number(d.slice(7, 9)),
  }
}

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || process.env.INSFORGE_URL
const apiKey = process.env.INSFORGE_API_KEY
if (!baseUrl || !apiKey) {
  console.error('Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY')
  process.exit(1)
}

const db = createAdminClient({ baseUrl, apiKey }).database

console.log(`Buscando cuotas 00 pagadas el ${fechaHoy}…`)

const { data: pagosHoy, error: errHoy } = await db
  .from('pago_detalle')
  .select('pago_id, alumno_id, pago_referencia, pago_importe, pago_cancelado, pago_fecha')
  .eq('pago_fecha', fechaHoy)
  .gt('pago_importe', 0)
  .limit(3000)

if (errHoy) {
  console.error(errHoy)
  process.exit(1)
}

const afectados = new Map() // alumno_id -> Set(ciclos)
for (const p of pagosHoy ?? []) {
  const canc = Number(p.pago_cancelado)
  if (canc === 1 || canc === 2) continue
  const parsed = parseRef(p.pago_referencia)
  if (!parsed || parsed.concepto !== '00') continue
  if (!afectados.has(p.alumno_id)) afectados.set(p.alumno_id, new Set())
  afectados.get(p.alumno_id).add(parsed.ciclo)
}

console.log(`Alumnos con cuota 00 real hoy: ${afectados.size}`)
if (afectados.size === 0) {
  console.log('Nada que limpiar.')
  process.exit(0)
}

let totalAnulados = 0
for (const [alumnoId, ciclos] of afectados) {
  const { data: fantasma, error } = await db
    .from('pago_detalle')
    .select(
      'pago_id, alumno_id, pago_referencia, pago_importe, pago_forma, pago_cancelado, pago_fecha, pago_nombre'
    )
    .eq('alumno_id', alumnoId)
    .eq('pago_forma', FORMA)
    .eq('pago_importe', 0)
    .eq('pago_cancelado', 3)
    .limit(500)

  if (error) {
    console.error('alumno', alumnoId, error.message)
    continue
  }

  const aAnular = (fantasma ?? []).filter((p) => {
    const parsed = parseRef(p.pago_referencia)
    if (!parsed) return false
    // Del 00 en adelante = colegiaturas del ciclo de la cuota (01…26, 16)
    if (parsed.concepto === '00') return false
    return ciclos.has(parsed.ciclo)
  })

  if (aAnular.length === 0) {
    console.log(`alumno ${alumnoId}: sin fantasma mid-ciclo`)
    continue
  }

  console.log(
    `alumno ${alumnoId}: anular ${aAnular.length} pagos mid-ciclo ciclos=[${[...ciclos].join(',')}]`,
    aAnular.map((p) => p.pago_referencia).join(', ')
  )

  if (dryRun) continue

  for (const p of aAnular) {
    const { error: upErr } = await db
      .from('pago_detalle')
      .update({
        pago_cancelado: 2,
        pago_actualizacion: new Date().toISOString(),
      })
      .eq('pago_id', p.pago_id)
    if (upErr) {
      console.error('  fail', p.pago_id, upErr.message)
    } else {
      totalAnulados += 1
    }
  }
}

console.log(dryRun ? `Dry-run listo.` : `Listo. Anulados (devolución): ${totalAnulados}`)
