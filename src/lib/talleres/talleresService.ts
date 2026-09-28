import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  COLORES_TALLER,
  DIAS_TALLER,
  etiquetaDia,
  hora12,
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
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const SELECT_TALLER = 'id, nombre, grados, descripcion, niveles, color, activo'
const SELECT_MAESTRO =
  'id, nombre, apellido_paterno, apellido_materno, email, celular, especialidad, niveles, notas, activo'
const SELECT_ASIGNACION =
  'id, taller_id, maestro_id, ciclo_escolar, niveles, lugar, cupo, notas, activo'

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

/** Ciclo de temporada (`ciclos_escolares.es_actual`); nunca un valor fijo. */
export async function cicloActualTalleres(): Promise<{ valor: number; nombre: string }> {
  const { data, error } = await db()
    .from('ciclos_escolares')
    .select('valor, nombre')
    .eq('es_actual', true)
    .maybeSingle()
  fail(error, 'Ciclo escolar')
  const row = data as { valor: number; nombre: string } | null
  if (!row) throw new TalleresError('No hay ciclo escolar marcado como actual.', 500)
  return { valor: Number(row.valor), nombre: String(row.nombre) }
}

function mapTaller(r: Record<string, unknown>): Taller {
  return {
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    grados: (r.grados as string | null) ?? null,
    descripcion: (r.descripcion as string | null) ?? null,
    niveles: normalizarNiveles(r.niveles),
    color: (r.color as string | null) ?? null,
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

async function listarAsignaciones(ciclo: number): Promise<TallerAsignacion[]> {
  const { data, error } = await db()
    .from('taller_asignacion')
    .select(SELECT_ASIGNACION)
    .eq('ciclo_escolar', ciclo)
    .eq('activo', true)
    .order('id', { ascending: true })
  fail(error, 'Asignaciones')
  const rows = (data ?? []) as Record<string, unknown>[]
  const ids = rows.map((r) => Number(r.id))
  const horariosPor = new Map<number, TallerHorario[]>()
  if (ids.length) {
    const { data: hs, error: hErr } = await db()
      .from('taller_horario')
      .select('id, asignacion_id, dia, hora_inicio, hora_fin')
      .in('asignacion_id', ids)
    fail(hErr, 'Horarios')
    for (const h of (hs ?? []) as Record<string, unknown>[]) {
      const aid = Number(h.asignacion_id)
      const list = horariosPor.get(aid) ?? []
      list.push({
        id: Number(h.id),
        dia: Number(h.dia),
        hora_inicio: normalizarHora(h.hora_inicio) ?? '00:00',
        hora_fin: normalizarHora(h.hora_fin) ?? '00:00',
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
    notas: (r.notas as string | null) ?? null,
    activo: Boolean(r.activo),
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
    listarAsignaciones(ciclo.valor),
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

/* ───────────── Talleres ───────────── */

function tallerDesdeBody(body: Record<string, unknown>) {
  const nombre = texto(body.nombre, 120)
  if (!nombre) throw new TalleresError('El nombre del taller es obligatorio.')
  const niveles = normalizarNiveles(body.niveles)
  if (!niveles.length) throw new TalleresError('Selecciona al menos un nivel para el taller.')
  const colorRaw = String(body.color ?? '').trim()
  const color = /^#[0-9a-f]{6}$/i.test(colorRaw) ? colorRaw : COLORES_TALLER[0]
  return {
    nombre,
    grados: texto(body.grados, 60),
    descripcion: texto(body.descripcion, 2000),
    niveles,
    color,
    activo: body.activo === undefined ? true : Boolean(body.activo),
  }
}

function errorDuplicado(error: { message?: string; code?: string } | null): boolean {
  return Boolean(error && (error.code === '23505' || /duplicate|unique/i.test(error.message ?? '')))
}

export async function guardarTaller(body: Record<string, unknown>): Promise<void> {
  const input = tallerDesdeBody(body)
  const id = Number(body.id) || 0
  const q = id
    ? db().from('taller').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id)
    : db().from('taller').insert([input])
  const { error } = await q
  if (errorDuplicado(error)) {
    throw new TalleresError(`Ya existe un taller «${nombreTallerCompleto(input)}».`, 409)
  }
  fail(error, 'Guardar taller')
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
  const id = Number(body.id) || 0
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
    const h = { dia, hora_inicio: ini, hora_fin: fin }
    const choque = out.find((o) => rangosSeTraslapan(o, h))
    if (choque) throw new TalleresError(`Hay dos horarios encimados el ${etiquetaDia(dia)}.`)
    out.push(h)
  }
  return out
}

function describirChoque(h: TallerHorario): string {
  return `${etiquetaDia(h.dia)} ${hora12(h.hora_inicio)} – ${hora12(h.hora_fin)}`
}

export async function guardarAsignacion(body: Record<string, unknown>): Promise<void> {
  const id = Number(body.id) || 0
  const tallerId = Number(body.taller_id) || 0
  const maestroId = Number(body.maestro_id) || 0
  if (!tallerId) throw new TalleresError('Selecciona el taller.')
  if (!maestroId) throw new TalleresError('Selecciona el maestro.')
  const horarios = horariosDesdeBody(body.horarios)
  const lugar = texto(body.lugar, 80)
  const cupoNum = Number(body.cupo)
  const cupo = body.cupo === '' || body.cupo == null ? null : Number.isFinite(cupoNum) && cupoNum > 0 ? Math.floor(cupoNum) : NaN
  if (Number.isNaN(cupo)) throw new TalleresError('El cupo debe ser un número mayor a cero.')

  const snap = await snapshotTalleres()
  const taller = snap.talleres.find((t) => t.id === tallerId)
  const maestro = snap.maestros.find((m) => m.id === maestroId)
  if (!taller || !taller.activo) throw new TalleresError('El taller no existe o está inactivo.')
  if (!maestro || !maestro.activo) throw new TalleresError('El maestro no existe o está inactivo.')

  const comunes = taller.niveles.filter((n) => maestro.niveles.includes(n))
  if (!comunes.length) {
    throw new TalleresError('El maestro no atiende ninguno de los niveles de este taller.')
  }
  let niveles = normalizarNiveles(body.niveles).filter((n) => comunes.includes(n))
  if (!niveles.length) niveles = comunes

  for (const otra of snap.asignaciones) {
    if (otra.id === id) continue
    const mismoMaestro = otra.maestro_id === maestroId
    const mismoLugar = Boolean(lugar && otra.lugar && otra.lugar.trim().toLowerCase() === lugar.toLowerCase())
    if (!mismoMaestro && !mismoLugar) continue
    for (const h of horarios) {
      const choque = otra.horarios.find((o) => rangosSeTraslapan(o, h))
      if (!choque) continue
      const t = snap.talleres.find((x) => x.id === otra.taller_id)
      const nombreOtro = t ? nombreTallerCompleto(t) : 'otro taller'
      if (mismoMaestro) {
        throw new TalleresError(
          `${nombreMaestroTaller(maestro)} ya tiene «${nombreOtro}» el ${describirChoque(choque)}.`,
          409
        )
      }
      throw new TalleresError(`«${lugar}» ya está ocupado por «${nombreOtro}» el ${describirChoque(choque)}.`, 409)
    }
  }

  const input = {
    taller_id: tallerId,
    maestro_id: maestroId,
    niveles,
    lugar,
    cupo,
    notas: texto(body.notas, 2000),
  }

  let asignacionId = id
  if (id) {
    const { error } = await db()
      .from('taller_asignacion')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
    fail(error, 'Guardar asignación')
    const { error: delErr } = await db().from('taller_horario').delete().eq('asignacion_id', id)
    fail(delErr, 'Actualizar horario')
  } else {
    const { data, error } = await db()
      .from('taller_asignacion')
      .insert([{ ...input, ciclo_escolar: snap.ciclo.valor }])
      .select('id')
      .single()
    fail(error, 'Crear asignación')
    asignacionId = Number((data as { id: number }).id)
  }

  const { error: hErr } = await db()
    .from('taller_horario')
    .insert(horarios.map((h) => ({ asignacion_id: asignacionId, ...h })))
  fail(hErr, 'Guardar horario')
}

export async function eliminarAsignacion(id: number): Promise<void> {
  const { error } = await db().from('taller_asignacion').delete().eq('id', id)
  fail(error, 'Eliminar asignación')
}
