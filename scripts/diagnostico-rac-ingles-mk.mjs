#!/usr/bin/env node
/**
 * Diagnóstico: avisos/reportes académicos de Teachers (Inglés) en Maternal/Kinder.
 * Uso: node --env-file=.env.local scripts/diagnostico-rac-ingles-mk.mjs
 */
import { createAdminClient } from '@insforge/sdk'

const db = createAdminClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  apiKey: process.env.INSFORGE_API_KEY,
}).database

const { data: last } = await db
  .from('reporte_escolar')
  .select('reporte_ciclo_escolar')
  .order('reporte_id', { ascending: false })
  .limit(1)
const ciclo = last?.[0]?.reporte_ciclo_escolar
console.log('ciclo', ciclo)

const { data: mats } = await db
  .from('boleta_materia')
  .select('materia_id, materia_nombre, materia_nivel, materia_grado, materia_orden')
  .in('materia_nivel', [1, 2])
  .order('materia_nivel')
  .order('materia_grado')
  .order('materia_orden')

console.log('\nMaterias MK (ES/EN slots):')
for (const m of mats ?? []) {
  const tag =
    Number(m.materia_orden) === 2 || String(m.materia_nombre).toLowerCase().includes('teacher')
      ? 'EN'
      : Number(m.materia_orden) === 1 || String(m.materia_nombre).toLowerCase().includes('maestro')
        ? 'ES'
        : '?'
  console.log(tag, m)
}

const { data: reps } = await db
  .from('reporte_escolar')
  .select(
    'reporte_id, alumno_id, materia_id, reporte_tipo, reporte_no, reporte_status, reporte_ciclo_escolar, reporte_registro, usuario_id'
  )
  .eq('reporte_tipo', 1)
  .eq('reporte_ciclo_escolar', ciclo)
  .eq('reporte_status', 1)
  .order('reporte_id', { ascending: false })
  .limit(500)

const aids = [...new Set((reps ?? []).map((r) => r.alumno_id))]
const { data: alums } = await db
  .from('alumno')
  .select('alumno_id, alumno_ref, alumno_nivel, alumno_grado, alumno_grupo, alumno_app, alumno_nombre')
  .in('alumno_id', aids.length ? aids : [0])
const aMap = new Map((alums ?? []).map((a) => [a.alumno_id, a]))
const mMap = new Map((mats ?? []).map((m) => [m.materia_id, m]))

const mk = (reps ?? []).filter((r) => {
  const a = aMap.get(r.alumno_id)
  return a && (Number(a.alumno_nivel) === 1 || Number(a.alumno_nivel) === 2)
})

console.log('\nAcadémicos MK activos:', mk.length)
const byMat = new Map()
for (const r of mk) byMat.set(r.materia_id ?? 'NULL', (byMat.get(r.materia_id ?? 'NULL') ?? 0) + 1)
console.log('Por materia_id:')
for (const [id, n] of [...byMat.entries()].sort((a, b) => b[1] - a[1])) {
  const m = mMap.get(id)
  console.log(n, id, m ? `${m.materia_nombre} ord=${m.materia_orden} n${m.materia_nivel} g${m.materia_grado}` : 'NO_EN_LISTA_MK')
}

console.log('\nDetalle:')
for (const r of mk) {
  const a = aMap.get(r.alumno_id)
  const m = mMap.get(r.materia_id)
  console.log({
    rid: r.reporte_id,
    no: r.reporte_no,
    matId: r.materia_id,
    mat: m?.materia_nombre ?? '?',
    ord: m?.materia_orden,
    alum: a ? `ref=${a.alumno_ref} n${a.alumno_nivel} g${a.alumno_grado}` : '?',
    fecha: String(r.reporte_registro ?? '').slice(0, 10),
    user: r.usuario_id,
  })
}
