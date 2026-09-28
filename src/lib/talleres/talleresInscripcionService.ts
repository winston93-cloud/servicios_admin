import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  estadoCupo,
  etiquetaDia,
  etiquetaGradoAlumno,
  etiquetaNivel,
  gradoGlobal,
  gradosPermitidos,
  hora12,
  nombreTallerCompleto,
  rangosSeTraslapan,
  type AlumnoBusquedaTaller,
  type AlumnoTaller,
  type EstadoInscripcion,
  type TallerAsignacion,
  type TallerInscripcion,
  type TalleresSnapshot,
} from '@/lib/talleres/talleresTypes'
import { TalleresError, snapshotTalleres } from '@/lib/talleres/talleresService'

const SELECT_ALUMNO = 'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
const SELECT_INSCRIPCION =
  'id, asignacion_id, alumno_id, estado, notas, fecha_alta, fecha_baja, motivo_baja, registrado_por'
const ALUMNO_ACTIVO = 1
const MAX_RESULTADOS = 20

function db() {
  return createDbAdmin()
}

function fail(error: { message?: string } | null, contexto: string): void {
  if (error) throw new TalleresError(`${contexto}: ${error.message ?? 'error de base de datos'}`, 500)
}

function texto(raw: unknown, max: number): string | null {
  const s = String(raw ?? '').trim()
  return s ? s.slice(0, max) : null
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function mapAlumno(r: Record<string, unknown>): AlumnoTaller {
  const nombre = [r.alumno_nombre, r.alumno_app, r.alumno_apm]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
  return {
    alumno_id: Number(r.alumno_id),
    alumno_ref: r.alumno_ref == null ? null : Number(r.alumno_ref),
    nombre: nombre || `No. control ${r.alumno_ref ?? ''}`.trim(),
    nivel: Number(r.alumno_nivel) || 0,
    grado: r.alumno_grado == null ? null : Number(r.alumno_grado),
    grupo: r.alumno_grupo == null ? null : Number(r.alumno_grupo),
  }
}

async function alumnosPorId(ids: number[]): Promise<Map<number, AlumnoTaller>> {
  const out = new Map<number, AlumnoTaller>()
  if (!ids.length) return out
  const { data, error } = await db().from('alumno').select(SELECT_ALUMNO).in('alumno_id', ids)
  fail(error, 'Alumnos')
  for (const r of (data ?? []) as Record<string, unknown>[]) out.set(Number(r.alumno_id), mapAlumno(r))
  return out
}

/** Inscripciones vigentes del alumno en grupos del ciclo actual. */
async function inscripcionesVigentesDe(alumnoIds: number[], asignacionIds: number[]) {
  if (!alumnoIds.length || !asignacionIds.length) return [] as { id: number; alumno_id: number; asignacion_id: number }[]
  const { data, error } = await db()
    .from('taller_inscripcion')
    .select('id, alumno_id, asignacion_id')
    .in('alumno_id', alumnoIds)
    .in('asignacion_id', asignacionIds)
    .eq('estado', 'inscrito')
  fail(error, 'Inscripciones del alumno')
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    alumno_id: Number(r.alumno_id),
    asignacion_id: Number(r.asignacion_id),
  }))
}

/* ───────────── Búsqueda de alumnos ───────────── */

let cacheActivos: { en: number; lista: AlumnoTaller[] } | null = null
const CACHE_MS = 60_000

/** Alumnos activos (pocos cientos): se filtran en memoria para ignorar acentos. */
async function alumnosActivos(): Promise<AlumnoTaller[]> {
  if (cacheActivos && Date.now() - cacheActivos.en < CACHE_MS) return cacheActivos.lista
  const lista: AlumnoTaller[] = []
  const LOTE = 1000
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await db()
      .from('alumno')
      .select(SELECT_ALUMNO)
      .eq('alumno_status', ALUMNO_ACTIVO)
      .order('alumno_id', { ascending: true })
      .range(desde, desde + LOTE - 1)
    fail(error, 'Alumnos activos')
    const filas = (data ?? []) as Record<string, unknown>[]
    lista.push(...filas.map(mapAlumno))
    if (filas.length < LOTE) break
  }
  cacheActivos = { en: Date.now(), lista }
  return lista
}

export async function buscarAlumnosTaller(q: string, niveles: number[]): Promise<AlumnoBusquedaTaller[]> {
  const limpia = q.replace(/\s+/g, ' ').trim()
  if (limpia.length < 2) return []
  const tokens = norm(limpia).split(' ').filter(Boolean)

  const alumnos = (await alumnosActivos())
    .filter((a) => !niveles.length || niveles.includes(a.nivel))
    .map((a) => {
      const n = norm(a.nombre)
      const ref = String(a.alumno_ref ?? '')
      const ok = tokens.every((t) => n.includes(t) || ref.startsWith(t))
      const pts = (ref === limpia ? 1000 : 0) + (n.startsWith(tokens[0]) ? 50 : 0) + (ok ? 100 : 0)
      return { a, ok, pts }
    })
    .filter((x) => x.ok)
    .sort((x, y) => y.pts - x.pts || x.a.nombre.localeCompare(y.a.nombre, 'es'))
    .slice(0, MAX_RESULTADOS)
    .map((x) => x.a)

  const snap = await snapshotTalleres()
  const vigentes = await inscripcionesVigentesDe(
    alumnos.map((a) => a.alumno_id),
    snap.asignaciones.map((a) => a.id)
  )
  return alumnos.map((a) => ({
    ...a,
    asignaciones: vigentes.filter((v) => v.alumno_id === a.alumno_id).map((v) => v.asignacion_id),
  }))
}

/* ───────────── Consultas ───────────── */

async function mapInscripciones(rows: Record<string, unknown>[]): Promise<TallerInscripcion[]> {
  const alumnos = await alumnosPorId([...new Set(rows.map((r) => Number(r.alumno_id)))])
  return rows.map((r) => ({
    id: Number(r.id),
    asignacion_id: Number(r.asignacion_id),
    alumno:
      alumnos.get(Number(r.alumno_id)) ??
      { alumno_id: Number(r.alumno_id), alumno_ref: null, nombre: `Alumno ${r.alumno_id}`, nivel: 0, grado: null, grupo: null },
    estado: (r.estado as EstadoInscripcion) ?? 'inscrito',
    notas: (r.notas as string | null) ?? null,
    fecha_alta: String(r.fecha_alta ?? ''),
    fecha_baja: (r.fecha_baja as string | null) ?? null,
    motivo_baja: (r.motivo_baja as string | null) ?? null,
    registrado_por: (r.registrado_por as string | null) ?? null,
  }))
}

export async function inscripcionesDeGrupo(asignacionId: number): Promise<TallerInscripcion[]> {
  const { data, error } = await db()
    .from('taller_inscripcion')
    .select(SELECT_INSCRIPCION)
    .eq('asignacion_id', asignacionId)
  fail(error, 'Inscripciones del grupo')
  const lista = await mapInscripciones((data ?? []) as Record<string, unknown>[])
  return lista.sort(
    (a, b) =>
      (a.estado === b.estado ? 0 : a.estado === 'inscrito' ? -1 : 1) ||
      a.alumno.nombre.localeCompare(b.alumno.nombre, 'es')
  )
}

export async function inscripcionesDeAlumno(alumnoId: number): Promise<{
  alumno: AlumnoTaller | null
  inscripciones: TallerInscripcion[]
}> {
  const snap = await snapshotTalleres()
  const ids = snap.asignaciones.map((a) => a.id)
  const alumno = (await alumnosPorId([alumnoId])).get(alumnoId) ?? null
  if (!ids.length) return { alumno, inscripciones: [] }
  const { data, error } = await db()
    .from('taller_inscripcion')
    .select(SELECT_INSCRIPCION)
    .eq('alumno_id', alumnoId)
    .in('asignacion_id', ids)
  fail(error, 'Inscripciones del alumno')
  return { alumno, inscripciones: await mapInscripciones((data ?? []) as Record<string, unknown>[]) }
}

/* ───────────── Validación ───────────── */

function describirGrupo(snap: TalleresSnapshot, a: TallerAsignacion): string {
  const t = snap.talleres.find((x) => x.id === a.taller_id)
  return t ? nombreTallerCompleto(t) : 'otro taller'
}

/**
 * Reglas duras (error) y avisos (requieren confirmación).
 * `excluirInscripcionId`: al mover, no chocar contra la propia inscripción.
 */
async function validarInscripcion(opts: {
  snap: TalleresSnapshot
  asignacionId: number
  alumnoId: number
  excluirInscripcionId?: number
  forzar: boolean
}): Promise<{ asignacion: TallerAsignacion; alumno: AlumnoTaller }> {
  const { snap, asignacionId, alumnoId, excluirInscripcionId, forzar } = opts
  const asignacion = snap.asignaciones.find((a) => a.id === asignacionId)
  if (!asignacion) throw new TalleresError('El grupo no existe o no es del ciclo actual.', 404)
  const taller = snap.talleres.find((t) => t.id === asignacion.taller_id)

  const { data, error } = await db()
    .from('alumno')
    .select(`${SELECT_ALUMNO}, alumno_status`)
    .eq('alumno_id', alumnoId)
    .maybeSingle()
  fail(error, 'Alumno')
  if (!data) throw new TalleresError('El alumno no existe.', 404)
  const fila = data as Record<string, unknown>
  const alumno = mapAlumno(fila)
  if (Number(fila.alumno_status) !== ALUMNO_ACTIVO) {
    throw new TalleresError(`${alumno.nombre} no está activo en el ciclo actual.`)
  }
  if (!asignacion.niveles.includes(alumno.nivel)) {
    throw new TalleresError(
      `${alumno.nombre} es de ${etiquetaNivel(alumno.nivel)}; este grupo es para ${asignacion.niveles.map(etiquetaNivel).join(' y ')}.`
    )
  }

  const vigentes = (await inscripcionesVigentesDe([alumnoId], snap.asignaciones.map((a) => a.id))).filter(
    (v) => v.id !== excluirInscripcionId
  )
  if (vigentes.some((v) => v.asignacion_id === asignacionId)) {
    throw new TalleresError(`${alumno.nombre} ya está inscrito en este grupo.`, 409)
  }
  for (const v of vigentes) {
    const otra = snap.asignaciones.find((a) => a.id === v.asignacion_id)
    if (!otra) continue
    for (const h of asignacion.horarios) {
      const choque = otra.horarios.find((o) => rangosSeTraslapan(o, h))
      if (choque) {
        throw new TalleresError(
          `${alumno.nombre} ya está en «${describirGrupo(snap, otra)}» el ${etiquetaDia(choque.dia)} ${hora12(choque.hora_inicio)} – ${hora12(choque.hora_fin)}; se empalma con este horario.`,
          409
        )
      }
    }
  }

  const avisos: string[] = []
  const permitidos = gradosPermitidos(taller?.grados ?? null)
  const g = gradoGlobal(alumno.nivel, alumno.grado)
  if (permitidos && g != null && !permitidos.has(g)) {
    avisos.push(`${alumno.nombre} es de ${etiquetaGradoAlumno(alumno)} y el taller es para ${taller?.grados}.`)
  }
  if (estadoCupo(asignacion) === 'lleno') {
    avisos.push(`El grupo ya tiene el cupo lleno (${asignacion.inscritos} de ${asignacion.cupo}).`)
  }
  if (avisos.length && !forzar) {
    throw new TalleresError('Revisa antes de continuar.', 422, avisos)
  }
  return { asignacion, alumno }
}

/* ───────────── Altas, cambios y bajas ───────────── */

export async function inscribirAlumno(body: Record<string, unknown>, registradoPor: string | null): Promise<void> {
  const asignacionId = Number(body.asignacion_id) || 0
  const alumnoId = Number(body.alumno_id) || 0
  if (!asignacionId || !alumnoId) throw new TalleresError('Selecciona el grupo y el alumno.')
  const snap = await snapshotTalleres()
  const { alumno } = await validarInscripcion({ snap, asignacionId, alumnoId, forzar: Boolean(body.forzar) })

  const { data: previa, error: pErr } = await db()
    .from('taller_inscripcion')
    .select('id')
    .eq('asignacion_id', asignacionId)
    .eq('alumno_id', alumnoId)
    .maybeSingle()
  fail(pErr, 'Revisar inscripción previa')
  const ahora = new Date().toISOString()
  if (previa) {
    const { error } = await db()
      .from('taller_inscripcion')
      .update({
        estado: 'inscrito',
        fecha_alta: ahora,
        fecha_baja: null,
        motivo_baja: null,
        notas: texto(body.notas, 1000),
        registrado_por: registradoPor,
        updated_at: ahora,
      })
      .eq('id', Number((previa as { id: number }).id))
    fail(error, 'Reinscribir')
    return
  }
  const { error } = await db()
    .from('taller_inscripcion')
    .insert([
      {
        asignacion_id: asignacionId,
        alumno_id: alumnoId,
        alumno_ref: alumno.alumno_ref,
        ciclo_escolar: snap.ciclo.valor,
        estado: 'inscrito',
        notas: texto(body.notas, 1000),
        registrado_por: registradoPor,
      },
    ])
  fail(error, 'Inscribir')
}

async function inscripcionPorId(id: number) {
  const { data, error } = await db().from('taller_inscripcion').select(SELECT_INSCRIPCION).eq('id', id).maybeSingle()
  fail(error, 'Inscripción')
  if (!data) throw new TalleresError('La inscripción no existe.', 404)
  return data as Record<string, unknown>
}

/** Cambia al alumno a otro grupo (mismas validaciones que una alta). */
export async function moverInscripcion(body: Record<string, unknown>, registradoPor: string | null): Promise<void> {
  const id = Number(body.id) || 0
  const destino = Number(body.asignacion_id) || 0
  if (!id || !destino) throw new TalleresError('Selecciona el grupo destino.')
  const ins = await inscripcionPorId(id)
  if (Number(ins.asignacion_id) === destino) throw new TalleresError('El alumno ya está en ese grupo.')
  const snap = await snapshotTalleres()
  await validarInscripcion({
    snap,
    asignacionId: destino,
    alumnoId: Number(ins.alumno_id),
    excluirInscripcionId: id,
    forzar: Boolean(body.forzar),
  })
  const { error: dErr } = await db()
    .from('taller_inscripcion')
    .delete()
    .eq('asignacion_id', destino)
    .eq('alumno_id', Number(ins.alumno_id))
    .eq('estado', 'baja')
  fail(dErr, 'Limpiar baja previa')
  const ahora = new Date().toISOString()
  const { error } = await db()
    .from('taller_inscripcion')
    .update({ asignacion_id: destino, estado: 'inscrito', fecha_baja: null, motivo_baja: null, registrado_por: registradoPor, updated_at: ahora })
    .eq('id', id)
  fail(error, 'Mover alumno')
}

export async function reactivarInscripcion(body: Record<string, unknown>, registradoPor: string | null): Promise<void> {
  const id = Number(body.id) || 0
  const ins = await inscripcionPorId(id)
  if (ins.estado === 'inscrito') throw new TalleresError('El alumno ya está inscrito.')
  const snap = await snapshotTalleres()
  await validarInscripcion({
    snap,
    asignacionId: Number(ins.asignacion_id),
    alumnoId: Number(ins.alumno_id),
    excluirInscripcionId: id,
    forzar: Boolean(body.forzar),
  })
  const ahora = new Date().toISOString()
  const { error } = await db()
    .from('taller_inscripcion')
    .update({ estado: 'inscrito', fecha_alta: ahora, fecha_baja: null, motivo_baja: null, registrado_por: registradoPor, updated_at: ahora })
    .eq('id', id)
  fail(error, 'Reinscribir')
}

export async function actualizarNotasInscripcion(body: Record<string, unknown>): Promise<void> {
  const id = Number(body.id) || 0
  await inscripcionPorId(id)
  const { error } = await db()
    .from('taller_inscripcion')
    .update({ notas: texto(body.notas, 1000), updated_at: new Date().toISOString() })
    .eq('id', id)
  fail(error, 'Guardar notas')
}

export async function bajaInscripcion(id: number, motivo: string | null): Promise<void> {
  const ins = await inscripcionPorId(id)
  if (ins.estado === 'baja') throw new TalleresError('El alumno ya estaba dado de baja.')
  const ahora = new Date().toISOString()
  const { error } = await db()
    .from('taller_inscripcion')
    .update({ estado: 'baja', fecha_baja: ahora, motivo_baja: texto(motivo, 200), updated_at: ahora })
    .eq('id', id)
  fail(error, 'Dar de baja')
}

export async function eliminarInscripcion(id: number): Promise<void> {
  await inscripcionPorId(id)
  const { error } = await db().from('taller_inscripcion').delete().eq('id', id)
  fail(error, 'Eliminar inscripción')
}

/** Conteo de inscritos por grupo del ciclo actual (para refrescar la UI tras un cambio). */
export async function conteoInscritos(): Promise<Record<number, number>> {
  const snap = await snapshotTalleres()
  return Object.fromEntries(snap.asignaciones.map((a) => [a.id, a.inscritos]))
}
