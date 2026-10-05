import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  COLORES_TALLER,
  DIAS_TALLER,
  etiquetaDia,
  etiquetaNivel,
  hora12,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  nombreTallerCompleto,
  normalizarHora,
  normalizarNiveles,
  rangosSeTraslapan,
  type Taller,
  type TallerAsignacion,
  type TallerHorario,
  type TallerMaestro,
  type TalleresSnapshot,
} from '@/lib/talleres/talleresTypes'

export class TalleresError extends Error {
  constructor(
    message: string,
    public status = 400,
    /** Avisos que el usuario puede aceptar reenviando con `forzar: true`. */
    public advertencias?: string[]
  ) {
    super(message)
  }
}

const SELECT_TALLER = 'id, nombre, grados, categoria, descripcion, niveles, color, cupo_min, cupo_max, activo'
const SELECT_MAESTRO =
  'id, nombre, apellido_paterno, apellido_materno, email, celular, especialidad, niveles, notas, activo'
const SELECT_ASIGNACION =
  'id, taller_id, maestro_id, ciclo_escolar, niveles, lugar, cupo, cupo_min, notas, activo'

function db() {
  return createDbAdmin()
}

function texto(raw: unknown, max: number): string | null {
  const s = String(raw ?? '').trim()
  return s ? s.slice(0, max) : null
}

function fail(error: { message?: string } | null, contexto: string): void {
  if (error) throw new TalleresError(`${contexto}: ${error.message ?? 'error de base de datos'}`, 500)
}

/** Id entero positivo; cualquier otra cosa (decimales, texto, notación científica) → 0. */
export function idEntero(raw: unknown): number {
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : 0
}

const PAGINA = 1000
const TROZO_IDS = 150

/** PostgREST corta en 1000 filas: pide páginas hasta agotar. La consulta debe ir ordenada. */
export async function todasLasFilas<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  contexto: string
): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pagina(desde, desde + PAGINA - 1)
    fail(error, contexto)
    const filas = (data ?? []) as T[]
    out.push(...filas)
    if (filas.length < PAGINA) return out
  }
}

/** Igual que `todasLasFilas`, partiendo la lista de ids para no exceder el largo de la URL. */
export async function filasPorIds<T>(
  ids: number[],
  pagina: (trozo: number[], desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  contexto: string
): Promise<T[]> {
  const unicos = [...new Set(ids)]
  const out: T[] = []
  for (let i = 0; i < unicos.length; i += TROZO_IDS) {
    const trozo = unicos.slice(i, i + TROZO_IDS)
    out.push(...(await todasLasFilas<T>((d, h) => pagina(trozo, d, h), contexto)))
  }
  return out
}

/** Baja general (0) y baja temporal (3): ya no asisten, no ocupan cupo ni salen en listas. */
const ALUMNO_STATUS_BAJA = new Set([0, 3])

/** Alumnos (de `ids`) que siguen en el colegio. */
export async function alumnosVigentes(ids: number[]): Promise<Set<number>> {
  const filas = await filasPorIds<{ alumno_id: number; alumno_status: number | null }>(
    ids,
    (trozo, d, h) =>
      db().from('alumno').select('alumno_id, alumno_status').in('alumno_id', trozo).order('alumno_id').range(d, h),
    'Estatus de alumnos'
  )
  return new Set(
    filas.filter((r) => !ALUMNO_STATUS_BAJA.has(Number(r.alumno_status))).map((r) => Number(r.alumno_id))
  )
}

/** Ciclo de temporada (`ciclos_escolares.es_actual`); nunca un valor fijo. */
export async function cicloActualTalleres(): Promise<{ valor: number; nombre: string }> {
  const { data, error } = await db()
    .from('ciclos_escolares')
    .select('valor, nombre')
    .eq('es_actual', true)
    .maybeSingle()
  fail(error, 'Ciclo escolar')
  const row = data as { valor: number; nombre: string } | null
  if (!row) throw new TalleresError('No hay ciclo escolar marcado como actual.', 503)
  return { valor: Number(row.valor), nombre: String(row.nombre) }
}

function mapTaller(r: Record<string, unknown>): Taller {
  return {
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    grados: (r.grados as string | null) ?? null,
    categoria: (r.categoria as string | null) ?? null,
    descripcion: (r.descripcion as string | null) ?? null,
    niveles: normalizarNiveles(r.niveles),
    color: (r.color as string | null) ?? null,
    cupo_min: r.cupo_min == null ? null : Number(r.cupo_min),
    cupo_max: r.cupo_max == null ? null : Number(r.cupo_max),
    activo: Boolean(r.activo),
  }
}

function mapMaestro(r: Record<string, unknown>): TallerMaestro {
  return {
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    apellido_paterno: (r.apellido_paterno as string | null) ?? null,
    apellido_materno: (r.apellido_materno as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    celular: (r.celular as string | null) ?? null,
    especialidad: (r.especialidad as string | null) ?? null,
    niveles: normalizarNiveles(r.niveles),
    notas: (r.notas as string | null) ?? null,
    activo: Boolean(r.activo),
  }
}

/** Grupos activos del ciclo, o grupos puntuales por id (cualquier ciclo, aunque estén dados de baja). */
async function listarAsignaciones(filtro: { ciclo: number } | { ids: number[] }): Promise<TallerAsignacion[]> {
  const rows =
    'ciclo' in filtro
      ? await todasLasFilas<Record<string, unknown>>(
          (d, h) =>
            db()
              .from('taller_asignacion')
              .select(SELECT_ASIGNACION)
              .eq('ciclo_escolar', filtro.ciclo)
              .eq('activo', true)
              .order('id', { ascending: true })
              .range(d, h),
          'Asignaciones'
        )
      : await filasPorIds<Record<string, unknown>>(
          filtro.ids,
          (trozo, d, h) =>
            db().from('taller_asignacion').select(SELECT_ASIGNACION).in('id', trozo).order('id').range(d, h),
          'Asignaciones'
        )
  const ids = rows.map((r) => Number(r.id))
  const horariosPor = new Map<number, TallerHorario[]>()
  const inscritosPor = new Map<number, number>()
  if (ids.length) {
    const ins = await filasPorIds<{ asignacion_id: number; alumno_id: number }>(
      ids,
      (trozo, d, h) =>
        db()
          .from('taller_inscripcion')
          .select('asignacion_id, alumno_id')
          .in('asignacion_id', trozo)
          .eq('estado', 'inscrito')
          .order('id')
          .range(d, h),
      'Inscripciones'
    )
    const vigentes = await alumnosVigentes(ins.map((r) => Number(r.alumno_id)))
    for (const r of ins) {
      if (!vigentes.has(Number(r.alumno_id))) continue
      const aid = Number(r.asignacion_id)
      inscritosPor.set(aid, (inscritosPor.get(aid) ?? 0) + 1)
    }
    const hs = await filasPorIds<Record<string, unknown>>(
      ids,
      (trozo, d, h) =>
        db()
          .from('taller_horario')
          .select('id, asignacion_id, dia, hora_inicio, hora_fin, lugar')
          .in('asignacion_id', trozo)
          .order('id')
          .range(d, h),
      'Horarios'
    )
    for (const h of hs) {
      const aid = Number(h.asignacion_id)
      const list = horariosPor.get(aid) ?? []
      list.push({
        id: Number(h.id),
        dia: Number(h.dia),
        hora_inicio: normalizarHora(h.hora_inicio) ?? '00:00',
        hora_fin: normalizarHora(h.hora_fin) ?? '00:00',
        lugar: (h.lugar as string | null) ?? null,
      })
      horariosPor.set(aid, list)
    }
  }
  return rows.map((r) => ({
    id: Number(r.id),
    taller_id: Number(r.taller_id),
    maestro_id: Number(r.maestro_id),
    ciclo_escolar: Number(r.ciclo_escolar),
    niveles: normalizarNiveles(r.niveles),
    lugar: (r.lugar as string | null) ?? null,
    cupo: r.cupo == null ? null : Number(r.cupo),
    cupo_min: r.cupo_min == null ? null : Number(r.cupo_min),
    notas: (r.notas as string | null) ?? null,
    activo: Boolean(r.activo),
    inscritos: inscritosPor.get(Number(r.id)) ?? 0,
    horarios: (horariosPor.get(Number(r.id)) ?? []).sort(
      (a, b) => a.dia - b.dia || minutosDeHora(a.hora_inicio) - minutosDeHora(b.hora_inicio)
    ),
  }))
}

export async function snapshotTalleres(): Promise<TalleresSnapshot> {
  const ciclo = await cicloActualTalleres()
  const [t, m, asignaciones] = await Promise.all([
    db().from('taller').select(SELECT_TALLER).order('nombre', { ascending: true }),
    db().from('taller_maestro').select(SELECT_MAESTRO).order('nombre', { ascending: true }),
    listarAsignaciones({ ciclo: ciclo.valor }),
  ])
  fail(t.error, 'Talleres')
  fail(m.error, 'Maestros de taller')
  return {
    ciclo,
    talleres: ((t.data ?? []) as Record<string, unknown>[]).map(mapTaller),
    maestros: ((m.data ?? []) as Record<string, unknown>[]).map(mapMaestro),
    asignaciones,
  }
}

export async function asignacionesPorIds(ids: number[]): Promise<TallerAsignacion[]> {
  return ids.length ? listarAsignaciones({ ids }) : []
}

/* ───────────── Talleres ───────────── */

function tallerDesdeBody(body: Record<string, unknown>) {
  const nombre = texto(body.nombre, 120)
  if (!nombre) throw new TalleresError('El nombre del taller es obligatorio.')
  const niveles = normalizarNiveles(body.niveles)
  if (!niveles.length) throw new TalleresError('Selecciona al menos un nivel para el taller.')
  const colorRaw = String(body.color ?? '').trim()
  const color = /^#[0-9a-f]{6}$/i.test(colorRaw) ? colorRaw : COLORES_TALLER[0]
  const { cupo, cupoMin } = cuposDesdeBody(body.cupo_max, body.cupo_min)
  return {
    nombre,
    grados: texto(body.grados, 60),
    categoria: texto(body.categoria, 40),
    descripcion: texto(body.descripcion, 2000),
    niveles,
    color,
    cupo_min: cupoMin,
    cupo_max: cupo,
    activo: body.activo === undefined ? true : Boolean(body.activo),
  }
}

function cuposDesdeBody(rawMax: unknown, rawMin: unknown): { cupo: number | null; cupoMin: number | null } {
  const cupo = enteroPositivo(rawMax)
  const cupoMin = enteroPositivo(rawMin)
  if (Number.isNaN(cupo)) throw new TalleresError('El cupo máximo debe ser un número mayor a cero.')
  if (Number.isNaN(cupoMin)) throw new TalleresError('El cupo mínimo debe ser un número mayor a cero.')
  if (cupo && cupoMin && cupoMin > cupo) {
    throw new TalleresError('El cupo mínimo no puede ser mayor que el máximo.')
  }
  return { cupo, cupoMin }
}

/**
 * Al cambiar el cupo base del taller, los grupos del ciclo actual que seguían el valor anterior
 * (o no tenían) toman el nuevo; los que se ajustaron a mano en Programados se respetan.
 */
async function propagarCupoTaller(
  tallerId: number,
  antes: { cupo_min: number | null; cupo_max: number | null },
  ahora: { cupo_min: number | null; cupo_max: number | null }
): Promise<void> {
  if (antes.cupo_min === ahora.cupo_min && antes.cupo_max === ahora.cupo_max) return
  const ciclo = await cicloActualTalleres()
  const { data, error } = await db()
    .from('taller_asignacion')
    .select('id, cupo, cupo_min')
    .eq('taller_id', tallerId)
    .eq('ciclo_escolar', ciclo.valor)
  fail(error, 'Grupos del taller')
  for (const g of (data ?? []) as { id: number; cupo: number | null; cupo_min: number | null }[]) {
    const cupo = g.cupo == null || g.cupo === antes.cupo_max ? ahora.cupo_max : g.cupo
    const cupoMin = g.cupo_min == null || g.cupo_min === antes.cupo_min ? ahora.cupo_min : g.cupo_min
    if (cupo === g.cupo && cupoMin === g.cupo_min) continue
    if (cupo && cupoMin && cupoMin > cupo) continue
    const { error: uErr } = await db()
      .from('taller_asignacion')
      .update({ cupo, cupo_min: cupoMin, updated_at: new Date().toISOString() })
      .eq('id', g.id)
    fail(uErr, 'Actualizar cupo del grupo')
  }
}

/** Ajuste rápido del cupo de un grupo (desde Programados). */
export async function actualizarCupoAsignacion(body: Record<string, unknown>): Promise<void> {
  const id = idEntero(body.id)
  if (!id) throw new TalleresError('Falta el grupo.')
  const { cupo, cupoMin } = cuposDesdeBody(body.cupo, body.cupo_min)
  const { data, error } = await db()
    .from('taller_asignacion')
    .update({ cupo, cupo_min: cupoMin, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  fail(error, 'Guardar cupo')
  if (!data || !(data as unknown[]).length) throw new TalleresError('El grupo ya no existe.', 404)
}

function errorDuplicado(error: { message?: string; code?: string } | null): boolean {
  return Boolean(error && (error.code === '23505' || /duplicate|unique/i.test(error.message ?? '')))
}

export async function guardarTaller(body: Record<string, unknown>): Promise<void> {
  const input = tallerDesdeBody(body)
  const id = idEntero(body.id)
  let antes: { cupo_min: number | null; cupo_max: number | null } | null = null
  if (id) {
    const { data, error } = await db().from('taller').select('cupo_min, cupo_max').eq('id', id).maybeSingle()
    fail(error, 'Taller')
    antes = (data as typeof antes) ?? null
  }
  const q = id
    ? db().from('taller').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id)
    : db().from('taller').insert([input])
  const { error } = await q
  if (errorDuplicado(error)) {
    throw new TalleresError(`Ya existe un taller «${nombreTallerCompleto(input)}».`, 409)
  }
  fail(error, 'Guardar taller')
  if (id && antes) await propagarCupoTaller(id, antes, input)
}

/* ───────────── Maestros de taller ───────────── */

function maestroDesdeBody(body: Record<string, unknown>) {
  const nombre = texto(body.nombre, 80)
  if (!nombre) throw new TalleresError('El nombre del maestro es obligatorio.')
  const niveles = normalizarNiveles(body.niveles)
  if (!niveles.length) throw new TalleresError('Selecciona al menos un nivel para el maestro.')
  const email = texto(body.email, 160)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TalleresError('El correo del maestro no es válido.')
  }
  return {
    nombre,
    apellido_paterno: texto(body.apellido_paterno, 80),
    apellido_materno: texto(body.apellido_materno, 80),
    email,
    celular: texto(body.celular, 30),
    especialidad: texto(body.especialidad, 120),
    niveles,
    notas: texto(body.notas, 2000),
    activo: body.activo === undefined ? true : Boolean(body.activo),
  }
}

export async function guardarMaestro(body: Record<string, unknown>): Promise<void> {
  const input = maestroDesdeBody(body)
  const id = idEntero(body.id)
  const q = id
    ? db().from('taller_maestro').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id)
    : db().from('taller_maestro').insert([input])
  const { error } = await q
  fail(error, 'Guardar maestro')
}

/* ───────────── Eliminar (baja lógica si ya tiene asignaciones) ───────────── */

async function tieneAsignaciones(campo: 'taller_id' | 'maestro_id', id: number): Promise<boolean> {
  const { data, error } = await db().from('taller_asignacion').select('id').eq(campo, id).limit(1)
  fail(error, 'Revisar asignaciones')
  return Boolean(data && (data as unknown[]).length)
}

export async function eliminarCatalogo(
  recurso: 'taller' | 'maestro',
  id: number
): Promise<{ modo: 'eliminado' | 'desactivado' }> {
  const tabla = recurso === 'taller' ? 'taller' : 'taller_maestro'
  const campo = recurso === 'taller' ? 'taller_id' : 'maestro_id'
  if (await tieneAsignaciones(campo, id)) {
    const { error } = await db()
      .from(tabla)
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    fail(error, 'Desactivar')
    return { modo: 'desactivado' }
  }
  const { error } = await db().from(tabla).delete().eq('id', id)
  fail(error, 'Eliminar')
  return { modo: 'eliminado' }
}

/* ───────────── Asignaciones + horario semanal ───────────── */

function horariosDesdeBody(raw: unknown): TallerHorario[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw new TalleresError('Agrega al menos un día con horario.')
  }
  const out: TallerHorario[] = []
  for (const item of raw as Record<string, unknown>[]) {
    const dia = Number(item?.dia)
    if (!DIAS_TALLER.some((d) => d.valor === dia)) throw new TalleresError('Día inválido en el horario.')
    const ini = normalizarHora(item?.hora_inicio)
    const fin = normalizarHora(item?.hora_fin)
    if (!ini || !fin) throw new TalleresError(`Horario incompleto el ${etiquetaDia(dia)}.`)
    if (minutosDeHora(fin) <= minutosDeHora(ini)) {
      throw new TalleresError(`El ${etiquetaDia(dia)} la hora de fin debe ser después de la de inicio.`)
    }
    const h = { dia, hora_inicio: ini, hora_fin: fin, lugar: texto(item?.lugar, 80) }
    if (out.some((o) => o.dia === dia)) throw new TalleresError(`Solo puede haber un horario el ${etiquetaDia(dia)}.`)
    out.push(h)
  }
  return out
}

/** '' / null → null; entero > 0 → número; cualquier otra cosa → NaN. */
function enteroPositivo(raw: unknown): number | null {
  if (raw === '' || raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : NaN
}

function describirChoque(h: TallerHorario): string {
  return `${etiquetaDia(h.dia)} ${hora12(h.hora_inicio)} – ${hora12(h.hora_fin)}`
}

export async function guardarAsignacion(body: Record<string, unknown>): Promise<void> {
  const id = idEntero(body.id)
  const tallerId = idEntero(body.taller_id)
  const maestroId = idEntero(body.maestro_id)
  if (!tallerId) throw new TalleresError('Selecciona el taller.')
  if (!maestroId) throw new TalleresError('Selecciona el maestro.')
  const horarios = horariosDesdeBody(body.horarios)
  const lugar = texto(body.lugar, 80)
  let { cupo, cupoMin } = cuposDesdeBody(body.cupo, body.cupo_min)

  const snap = await snapshotTalleres()
  const taller = snap.talleres.find((t) => t.id === tallerId)
  const maestro = snap.maestros.find((m) => m.id === maestroId)
  if (!taller || !taller.activo) throw new TalleresError('El taller no existe o está inactivo.')
  if (!maestro || !maestro.activo) throw new TalleresError('El maestro no existe o está inactivo.')
  if (!id) {
    cupo ??= taller.cupo_max
    cupoMin ??= taller.cupo_min
    if (cupo && cupoMin && cupoMin > cupo) {
      throw new TalleresError('El cupo mínimo del taller es mayor que el máximo de este grupo; ajusta ambos.')
    }
  }

  const comunes = taller.niveles.filter((n) => maestro.niveles.includes(n))
  if (!comunes.length) {
    throw new TalleresError('El maestro no atiende ninguno de los niveles de este taller.')
  }
  let niveles = normalizarNiveles(body.niveles).filter((n) => comunes.includes(n))
  if (!niveles.length) niveles = comunes
  if (id) {
    if (!snap.asignaciones.some((a) => a.id === id)) {
      throw new TalleresError('El grupo ya no existe o no es del ciclo actual. Recarga la página.', 404)
    }
    await validarNivelesDeInscritos(id, niveles)
  }

  const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
  for (const otra of snap.asignaciones) {
    if (otra.id === id) continue
    const mismoMaestro = otra.maestro_id === maestroId
    for (const h of horarios) {
      const lugarH = lugarDeHorario({ lugar }, h)
      for (const o of otra.horarios) {
        if (!rangosSeTraslapan(o, h)) continue
        const mismoLugar = Boolean(lugarH && norm(lugarH) === norm(lugarDeHorario(otra, o)))
        if (!mismoMaestro && !mismoLugar) continue
        const t = snap.talleres.find((x) => x.id === otra.taller_id)
        const nombreOtro = t ? nombreTallerCompleto(t) : 'otro taller'
        if (mismoMaestro) {
          throw new TalleresError(
            `${nombreMaestroTaller(maestro)} ya tiene «${nombreOtro}» el ${describirChoque(o)}.`,
            409
          )
        }
        throw new TalleresError(`«${lugarH}» ya está ocupado por «${nombreOtro}» el ${describirChoque(o)}.`, 409)
      }
    }
  }

  const input = {
    taller_id: tallerId,
    maestro_id: maestroId,
    niveles,
    lugar,
    cupo,
    cupo_min: cupoMin,
    notas: texto(body.notas, 2000),
  }

  if (!id) {
    const { data, error } = await db()
      .from('taller_asignacion')
      .insert([{ ...input, ciclo_escolar: snap.ciclo.valor }])
      .select('id')
      .single()
    fail(error, 'Crear asignación')
    const nuevoId = Number((data as { id: number }).id)
    const { error: hErr } = await db()
      .from('taller_horario')
      .insert(horarios.map((h) => ({ asignacion_id: nuevoId, ...h })))
    if (hErr) {
      await db().from('taller_asignacion').delete().eq('id', nuevoId)
      fail(hErr, 'Guardar horario')
    }
    return
  }

  // Primero el horario nuevo y luego se quita el anterior: si algo falla, el grupo nunca queda sin horario.
  const anteriores = (snap.asignaciones.find((a) => a.id === id)?.horarios ?? [])
    .map((h) => h.id)
    .filter((x): x is number => Number.isFinite(x))
  const { error: hErr } = await db()
    .from('taller_horario')
    .insert(horarios.map((h) => ({ asignacion_id: id, ...h })))
  fail(hErr, 'Guardar horario')
  if (anteriores.length) {
    const { error: delErr } = await db().from('taller_horario').delete().in('id', anteriores)
    fail(delErr, 'Actualizar horario')
  }
  const { error } = await db()
    .from('taller_asignacion')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  fail(error, 'Guardar asignación')
}

/** No quitar un nivel del grupo mientras tenga alumnos inscritos de ese nivel. */
async function validarNivelesDeInscritos(asignacionId: number, niveles: number[]): Promise<void> {
  const ins = await todasLasFilas<{ alumno_id: number }>(
    (d, h) =>
      db()
        .from('taller_inscripcion')
        .select('alumno_id')
        .eq('asignacion_id', asignacionId)
        .eq('estado', 'inscrito')
        .order('id')
        .range(d, h),
    'Inscripciones del grupo'
  )
  if (!ins.length) return
  const alumnos = await filasPorIds<{ alumno_id: number; alumno_nivel: number | null; alumno_status: number | null }>(
    ins.map((r) => Number(r.alumno_id)),
    (trozo, d, h) =>
      db()
        .from('alumno')
        .select('alumno_id, alumno_nivel, alumno_status')
        .in('alumno_id', trozo)
        .order('alumno_id')
        .range(d, h),
    'Alumnos del grupo'
  )
  const fuera = new Map<number, number>()
  for (const a of alumnos) {
    if (ALUMNO_STATUS_BAJA.has(Number(a.alumno_status))) continue
    const n = Number(a.alumno_nivel) || 0
    if (n && !niveles.includes(n)) fuera.set(n, (fuera.get(n) ?? 0) + 1)
  }
  if (!fuera.size) return
  const detalle = [...fuera.entries()]
    .map(([n, c]) => `${c} de ${etiquetaNivel(n)}`)
    .join(' y ')
  throw new TalleresError(
    `Este grupo tiene alumnos inscritos (${detalle}) del nivel que quieres quitar. Muévelos o dalos de baja en «Inscripciones» primero.`,
    409
  )
}

/**
 * Sin historial: se borra. Con pases de lista o incidencias registradas: baja lógica (`activo = false`),
 * para que las horas ya impartidas sigan en el reporte del maestro.
 */
export async function eliminarAsignacion(id: number): Promise<{ modo: 'eliminado' | 'desactivado' }> {
  const { data: ins, error: iErr } = await db()
    .from('taller_inscripcion')
    .select('id, estado')
    .eq('asignacion_id', id)
  fail(iErr, 'Revisar inscripciones')
  const activos = ((ins ?? []) as { estado: string }[]).filter((r) => r.estado === 'inscrito').length
  if (activos) {
    throw new TalleresError(
      `Este grupo tiene ${activos} ${activos === 1 ? 'alumno inscrito' : 'alumnos inscritos'}. Muévelos o dalos de baja en «Inscripciones» antes de eliminarlo.`,
      409
    )
  }
  const { data: asis, error: aErr } = await db()
    .from('taller_asistencia')
    .select('id')
    .eq('asignacion_id', id)
    .limit(1)
  fail(aErr, 'Revisar asistencia')
  if (asis && (asis as unknown[]).length) {
    const { error } = await db()
      .from('taller_asignacion')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    fail(error, 'Dar de baja el grupo')
    return { modo: 'desactivado' }
  }
  if ((ins ?? []).length) {
    const { error: dErr } = await db().from('taller_inscripcion').delete().eq('asignacion_id', id)
    fail(dErr, 'Limpiar bajas')
  }
  const { error } = await db().from('taller_asignacion').delete().eq('id', id)
  fail(error, 'Eliminar asignación')
  return { modo: 'eliminado' }
}
