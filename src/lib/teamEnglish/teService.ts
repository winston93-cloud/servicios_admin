import { createDbAdmin, createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { incidenciasReloj } from './teReloj'
import {
  COSTOS_SUGERIDO,
  ESTADOS_CURSO,
  ESTADOS_PLANEACION,
  MODALIDADES,
  SKILLS,
  EFECTOS_RECONOCIMIENTO,
  REACCIONES,
  TEMAS_RECONOCIMIENTO,
  type EfectoReconocimiento,
  type Reaccion,
  type TemaReconocimiento,
  type TeReconocimiento,
  type TeCursoSugerido,
  mensajeArchivoGrande,
  RUBROS,
  TE_EMOJIS,
  TE_MAX_ARCHIVO_MB,
  TIPOS_ANTECEDENTE,
  TIPOS_INCIDENCIA,
  CAMPOS_GENERALES,
  TIPOS_ITEM,
  type TeCampo,
  type TeDirectorioFila,
  type TeExpediente,
  type TeExpedienteItem,
  type TipoItemExpediente,
  gradosNivel,
  hoyMx,
  inicioCicloEscolar,
  lunesDe,
  normalizarPlan,
  bloquesDePlan,
  normalizarPonderadores,
  sumarDias,
  type TeAntecedente,
  type TeCapacitacion,
  type TeClassroom,
  type TeCurso,
  type TeIncidencia,
  type TeNivel,
  type TePlaneacion,
  type TeSnapshot,
  type TeTeacher,
} from './teTypes'

export const TE_BUCKET = 'team-english'

export class TeError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TeError'
    this.status = status
  }
}

const db = () => createDbAdmin()

function fail(error: { message?: string } | null | undefined, ctx: string): void {
  if (error) throw new Error(`${ctx}: ${error.message ?? 'error'}`)
}

/** Solo inglés Primaria: su directora, laura y mario. Nadie más. */
const NIVELES_POR_USUARIO: Record<number, TeNivel[]> = {
  10: [3], // coording · inglés primaria
  2: [3], // laura
  17: [3], // mario
}

export function nivelesPermitidos(usuarioId: number | null | undefined): TeNivel[] {
  return NIVELES_POR_USUARIO[Number(usuarioId)] ?? []
}

export function resolverNivel(usuarioId: number | null | undefined, raw: unknown): TeNivel {
  const permitidos = nivelesPermitidos(usuarioId)
  if (!permitidos.length) throw new TeError('No tienes acceso a Team English.', 403)
  const n = Number(raw)
  if (permitidos.includes(n as TeNivel)) return n as TeNivel
  if (raw != null && raw !== '') throw new TeError('No tienes acceso a ese nivel.', 403)
  return permitidos[0]
}

/* ── Validación ── */

function texto(raw: unknown, max: number, campo: string, requerido = false): string | null {
  const s = String(raw ?? '').trim()
  if (!s) {
    if (requerido) throw new TeError(`${campo} es obligatorio.`)
    return null
  }
  if (s.length > max) throw new TeError(`${campo}: máximo ${max} caracteres.`)
  return s
}

function fecha(raw: unknown, campo: string, requerido = true): string | null {
  const s = String(raw ?? '').trim()
  if (!s) {
    if (requerido) throw new TeError(`${campo} es obligatoria.`)
    return null
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) throw new TeError(`${campo} no es válida.`)
  return s
}

function entero(raw: unknown, campo: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new TeError(`${campo} no es válido.`)
  return n
}

/* ── Equipo ── */

type FilaMaestro = {
  maestro_id: number
  maestro_nombre: string | null
  maestro_app: string | null
  maestro_apm: string | null
  maestro_email: string | null
  maestro_celular: string | null
  maestro_usuario: string | null
}

function nombreMaestro(m: Pick<FilaMaestro, 'maestro_nombre' | 'maestro_app' | 'maestro_apm'>): string {
  const t = [m.maestro_nombre, m.maestro_app, m.maestro_apm]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
  return t
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, sp: string, l: string) => sp + l.toUpperCase())
}

async function asignacionesTeacher(nivel: TeNivel): Promise<Map<number, { grupos: Set<string>; grados: Set<number> }>> {
  const { data: materias, error } = await db()
    .from('boleta_materia')
    .select('materia_id, materia_grado')
    .eq('materia_nivel', nivel)
    .eq('materia_orden', 2)
  fail(error, 'Materias')
  const gradoDe = new Map<number, number>()
  for (const m of (materias ?? []) as { materia_id: number; materia_grado: number }[]) gradoDe.set(Number(m.materia_id), Number(m.materia_grado))
  const out = new Map<number, { grupos: Set<string>; grados: Set<number> }>()
  if (!gradoDe.size) return out
  const { data: grupos, error: gErr } = await db()
    .from('boleta_maestro_grupo')
    .select('maestro_id, materia_id, grupo_letra')
    .in('materia_id', [...gradoDe.keys()])
  fail(gErr, 'Grupos')
  for (const g of (grupos ?? []) as { maestro_id: number; materia_id: number; grupo_letra: string }[]) {
    const grado = gradoDe.get(Number(g.materia_id))
    if (!grado || !g.maestro_id) continue
    const e = out.get(Number(g.maestro_id)) ?? { grupos: new Set<string>(), grados: new Set<number>() }
    e.grupos.add(`${grado}${String(g.grupo_letra ?? '').trim().toUpperCase()}`)
    e.grados.add(grado)
    out.set(Number(g.maestro_id), e)
  }
  return out
}

export async function equipo(nivel: TeNivel, incluirInactivas = true): Promise<TeTeacher[]> {
  const [asig, perfilesRes, antRes] = await Promise.all([
    asignacionesTeacher(nivel),
    db().from('te_teacher').select('*').eq('nivel', nivel),
    db().from('te_antecedente').select('maestro_id').eq('nivel', nivel),
  ])
  fail(perfilesRes.error, 'Perfiles')
  fail(antRes.error, 'Antecedentes')
  const perfiles = new Map<number, Record<string, unknown>>()
  for (const p of (perfilesRes.data ?? []) as Record<string, unknown>[]) perfiles.set(Number(p.maestro_id), p)
  const ids = new Set<number>(asig.keys())
  for (const [id, p] of perfiles) if (p.manual) ids.add(id)
  if (!ids.size) return []

  const { data: maestros, error } = await db()
    .from('boleta_maestro')
    .select('maestro_id, maestro_nombre, maestro_app, maestro_apm, maestro_email, maestro_celular, maestro_usuario')
    .in('maestro_id', [...ids])
  fail(error, 'Maestros')

  const conteoAnt = new Map<number, number>()
  for (const a of (antRes.data ?? []) as { maestro_id: number }[]) conteoAnt.set(Number(a.maestro_id), (conteoAnt.get(Number(a.maestro_id)) ?? 0) + 1)

  const out: TeTeacher[] = []
  for (const m of (maestros ?? []) as FilaMaestro[]) {
    const id = Number(m.maestro_id)
    const p = perfiles.get(id) ?? {}
    const a = asig.get(id)
    const activo = p.activo === undefined ? true : Boolean(p.activo)
    if (!incluirInactivas && !activo) continue
    out.push({
      maestro_id: id,
      nombre: nombreMaestro(m),
      email: m.maestro_email || null,
      celular: m.maestro_celular || null,
      usuario: m.maestro_usuario || null,
      grupos: a ? [...a.grupos].sort() : [],
      grados: a ? [...a.grados].sort((x, y) => x - y) : gradosNivel(),
      manual: Boolean(p.manual) && !a,
      activo,
      emoji: String(p.emoji ?? TE_EMOJIS[id % TE_EMOJIS.length]),
      puesto: (p.puesto as string) ?? null,
      fecha_ingreso: (p.fecha_ingreso as string) ?? null,
      telefono: (p.telefono as string) ?? null,
      formacion: (p.formacion as string) ?? null,
      certificaciones: (p.certificaciones as string) ?? null,
      nivel_ingles: (p.nivel_ingles as string) ?? null,
      notas: (p.notas as string) ?? null,
      cv_key: (p.cv_key as string) ?? null,
      cv_nombre: (p.cv_nombre as string) ?? null,
      foto_key: (p.foto_key as string) ?? null,
      antecedentes: conteoAnt.get(id) ?? 0,
    })
  }
  return out.sort((x, y) => (x.grados[0] ?? 9) - (y.grados[0] ?? 9) || x.nombre.localeCompare(y.nombre, 'es'))
}

/** Maestros del nivel que aún no están en el equipo (para alta manual). */
export async function candidatos(nivel: TeNivel): Promise<{ maestro_id: number; nombre: string }[]> {
  const actuales = new Set((await equipo(nivel)).map((t) => t.maestro_id))
  const { data, error } = await db()
    .from('boleta_maestro')
    .select('maestro_id, maestro_nombre, maestro_app, maestro_apm')
    .eq('maestro_nivel', nivel)
  fail(error, 'Maestros')
  return ((data ?? []) as FilaMaestro[])
    .filter((m) => !actuales.has(Number(m.maestro_id)))
    .map((m) => ({ maestro_id: Number(m.maestro_id), nombre: nombreMaestro(m) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/* ── Snapshot ── */

function mapPlaneacion(r: Record<string, unknown>): TePlaneacion {
  return {
    id: Number(r.id),
    maestro_id: Number(r.maestro_id),
    grado: Number(r.grado),
    semana: String(r.semana).slice(0, 10),
    titulo: String(r.titulo ?? ''),
    notas: String(r.notas ?? ''),
    archivo_key: (r.archivo_key as string) ?? null,
    archivo_nombre: (r.archivo_nombre as string) ?? null,
    contenido: r.contenido && typeof r.contenido === 'object' ? (r.contenido as TePlaneacion['contenido']) : null,
    estado: r.estado as TePlaneacion['estado'],
    comentario: String(r.comentario ?? ''),
    version: Number(r.version ?? 1),
    subido_por: (r.subido_por as string) ?? null,
    subido_rol: r.subido_rol === 'directora' ? 'directora' : 'teacher',
    revisado_por: (r.revisado_por as string) ?? null,
    revisado_at: (r.revisado_at as string) ?? null,
    updated_at: String(r.updated_at ?? ''),
  }
}

async function capacitacionesNivel(nivel: TeNivel, maestroId?: number): Promise<TeCapacitacion[]> {
  const { data, error } = await db().from('te_capacitacion').select('*').eq('nivel', nivel).order('fecha_inicio', { ascending: false })
  fail(error, 'Capacitaciones')
  const caps = (data ?? []) as Record<string, unknown>[]
  if (!caps.length) return []
  const { data: parts, error: pErr } = await db()
    .from('te_capacitacion_teacher')
    .select('*')
    .in('capacitacion_id', caps.map((c) => Number(c.id)))
  fail(pErr, 'Participantes')
  const porCap = new Map<number, TeCapacitacion['participantes']>()
  for (const p of (parts ?? []) as Record<string, unknown>[]) {
    const l = porCap.get(Number(p.capacitacion_id)) ?? []
    l.push({
      maestro_id: Number(p.maestro_id),
      asistio: p.asistio == null ? null : Boolean(p.asistio),
      constancia_key: (p.constancia_key as string) ?? null,
      constancia_nombre: (p.constancia_nombre as string) ?? null,
    })
    porCap.set(Number(p.capacitacion_id), l)
  }
  const out = caps.map((c) => ({
    id: Number(c.id),
    titulo: String(c.titulo),
    tipo: c.tipo as TeCapacitacion['tipo'],
    modalidad: c.modalidad as TeCapacitacion['modalidad'],
    proveedor: (c.proveedor as string) ?? null,
    fecha_inicio: String(c.fecha_inicio).slice(0, 10),
    fecha_fin: c.fecha_fin ? String(c.fecha_fin).slice(0, 10) : null,
    horas: c.horas == null ? null : Number(c.horas),
    lugar: (c.lugar as string) ?? null,
    descripcion: String(c.descripcion ?? ''),
    estado: c.estado as TeCapacitacion['estado'],
    participantes: porCap.get(Number(c.id)) ?? [],
  }))
  return maestroId == null ? out : out.filter((c) => c.participantes.some((p) => p.maestro_id === maestroId))
}

function mapCurso(r: Record<string, unknown>): TeCurso {
  return {
    id: Number(r.id),
    maestro_id: Number(r.maestro_id),
    titulo: String(r.titulo),
    institucion: (r.institucion as string) ?? null,
    modalidad: r.modalidad as TeCurso['modalidad'],
    fecha: String(r.fecha).slice(0, 10),
    horas: r.horas == null ? null : Number(r.horas),
    notas: String(r.notas ?? ''),
    archivo_key: String(r.archivo_key),
    archivo_nombre: (r.archivo_nombre as string) ?? null,
    estado: r.estado as TeCurso['estado'],
    comentario: String(r.comentario ?? ''),
    revisado_por: (r.revisado_por as string) ?? null,
    revisado_at: (r.revisado_at as string) ?? null,
    created_at: String(r.created_at ?? ''),
  }
}

async function cursosDe(filtro: { nivel: TeNivel } | { maestroId: number }): Promise<TeCurso[]> {
  let q = db().from('te_curso').select('*')
  q = 'nivel' in filtro ? q.eq('nivel', filtro.nivel) : q.eq('maestro_id', filtro.maestroId)
  const { data, error } = await q.order('fecha', { ascending: false }).order('id', { ascending: false })
  fail(error, 'Cursos')
  return ((data ?? []) as Record<string, unknown>[]).map(mapCurso)
}

function mapSugerido(r: Record<string, unknown>): TeCursoSugerido {
  return {
    id: Number(r.id),
    titulo: String(r.titulo),
    institucion: (r.institucion as string) ?? null,
    modalidad: r.modalidad as TeCursoSugerido['modalidad'],
    enlace: String(r.enlace),
    skill: (r.skill as string) ?? null,
    costo: r.costo as TeCursoSugerido['costo'],
    horas: r.horas == null ? null : Number(r.horas),
    descripcion: String(r.descripcion ?? ''),
    activo: Boolean(r.activo),
    creado_por: (r.creado_por as string) ?? null,
  }
}

async function sugeridosDe(nivel: TeNivel, soloActivos: boolean): Promise<TeCursoSugerido[]> {
  let q = db().from('te_curso_sugerido').select('*').eq('nivel', nivel)
  if (soloActivos) q = q.eq('activo', true)
  const { data, error } = await q.order('id', { ascending: true })
  fail(error, 'Cursos sugeridos')
  return ((data ?? []) as Record<string, unknown>[]).map(mapSugerido)
}

function enlaceHttps(raw: unknown): string {
  const s = String(raw ?? '').trim()
  let url: URL
  try {
    url = new URL(s)
  } catch {
    throw new TeError('Pega el enlace completo del curso (https://…).')
  }
  if (url.protocol !== 'https:' || s.length > 500) throw new TeError('El enlace debe empezar con https:// y medir máximo 500 caracteres.')
  return url.toString()
}

async function reconocimientosDe(nivel: TeNivel, desde: string, teachers: TeTeacher[]): Promise<TeReconocimiento[]> {
  const { data, error } = await db()
    .from('te_reconocimiento')
    .select('*')
    .eq('nivel', nivel)
    .gte('semana', desde)
    .order('semana', { ascending: false })
    .order('id', { ascending: false })
    .limit(200)
  fail(error, 'Reconocimientos')
  const filas = (data ?? []) as Record<string, unknown>[]
  const ids = filas.map((r) => Number(r.id))
  const porRec = new Map<number, TeReconocimiento['vistos']>()
  if (ids.length) {
    const { data: vistos, error: vErr } = await db().from('te_reconocimiento_visto').select('reconocimiento_id, maestro_id, reaccion').in('reconocimiento_id', ids)
    fail(vErr, 'Reconocimientos')
    for (const v of (vistos ?? []) as Record<string, unknown>[]) {
      const lista = porRec.get(Number(v.reconocimiento_id)) ?? []
      lista.push({ maestro_id: Number(v.maestro_id), reaccion: (v.reaccion as Reaccion) ?? null })
      porRec.set(Number(v.reconocimiento_id), lista)
    }
  }
  const teacherDe = new Map(teachers.map((t) => [t.maestro_id, t]))
  return filas.map((r) => ({
    id: Number(r.id),
    semana: String(r.semana).slice(0, 10),
    titulo: String(r.titulo),
    mensaje: String(r.mensaje ?? ''),
    emoji: String(r.emoji ?? '🏆'),
    efectos: (r.efectos as EfectoReconocimiento[]) ?? ['confeti'],
    tema: r.tema as TemaReconocimiento,
    sonido: Boolean(r.sonido),
    temblor: Boolean(r.temblor),
    foto_key: (r.foto_key as string) ?? null,
    creado_por: (r.creado_por as string) ?? null,
    created_at: String(r.created_at ?? ''),
    homenajeadas: ((r.maestro_ids as number[]) ?? []).flatMap((id) => {
      const t = teacherDe.get(Number(id))
      return t ? [{ maestro_id: t.maestro_id, nombre: t.nombre, emoji: t.emoji }] : []
    }),
    vistos: porRec.get(Number(r.id)) ?? [],
  }))
}

/** La directora publica o edita un reconocimiento (multipart: foto opcional). */
export async function guardarReconocimiento(nivel: TeNivel, form: FormData, quien: string): Promise<void> {
  const leerJson = (k: string): unknown[] => {
    try {
      const v = JSON.parse(String(form.get(k) ?? '[]'))
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  const efectos = [...new Set(leerJson('efectos').map(String))].filter((e) => EFECTOS_RECONOCIMIENTO.some((x) => x.clave === e))
  if (!efectos.length) throw new TeError('Elige al menos un efecto.')
  const tema = String(form.get('tema') ?? 'arcoiris')
  if (!TEMAS_RECONOCIMIENTO.some((t) => t.clave === tema)) throw new TeError('Tema no válido.')
  const equipoIds = new Set((await equipo(nivel)).map((t) => t.maestro_id))
  const maestroIds = [...new Set(leerJson('maestro_ids').map(Number))].filter((id) => equipoIds.has(id))
  const emoji = texto(form.get('emoji'), 16, 'El emoji') ?? '🏆'
  const fila = {
    nivel,
    semana: lunesDe(fecha(form.get('semana'), 'La semana')!),
    titulo: texto(form.get('titulo'), 120, 'El título', true),
    mensaje: texto(form.get('mensaje'), 600, 'El mensaje') ?? '',
    emoji,
    maestro_ids: maestroIds,
    efectos,
    tema,
    sonido: form.get('sonido') !== '0',
    temblor: form.get('temblor') !== '0',
    updated_at: new Date().toISOString(),
  }
  const file = form.get('foto') instanceof File && (form.get('foto') as File).size ? (form.get('foto') as File) : null
  const subida = file ? await subir('evento', nivel, 0, file) : null
  const idRaw = form.get('id')
  try {
    if (idRaw) {
      const id = entero(idRaw, 'El reconocimiento')
      const { data: previo, error } = await db().from('te_reconocimiento').select('foto_key').eq('id', id).eq('nivel', nivel).maybeSingle()
      fail(error, 'Reconocimiento')
      if (!previo) throw new TeError('Reconocimiento no encontrado.', 404)
      const quitar = subida || form.get('quitar_foto') === '1'
      const { error: upErr } = await db()
        .from('te_reconocimiento')
        .update({ ...fila, ...(quitar ? { foto_key: subida?.key ?? null } : {}) })
        .eq('id', id)
        .eq('nivel', nivel)
      fail(upErr, 'Reconocimiento')
      if (quitar) await borrarArchivo(previo.foto_key as string)
      return
    }
    const { error } = await db().from('te_reconocimiento').insert([{ ...fila, foto_key: subida?.key ?? null, creado_por: quien }])
    fail(error, 'Reconocimiento')
  } catch (e) {
    if (subida) await borrarArchivo(subida.key)
    throw e
  }
}

/** La teacher vio el reconocimiento (y opcionalmente reacciona). `reaccion: null` la quita. */
export async function marcarReconocimiento(nivel: TeNivel, maestroId: number, id: number, reaccion?: string | null): Promise<void> {
  const { data, error } = await db().from('te_reconocimiento').select('id').eq('id', id).eq('nivel', nivel).maybeSingle()
  fail(error, 'Reconocimiento')
  if (!data) throw new TeError('Reconocimiento no encontrado.', 404)
  if (reaccion === undefined) {
    const { error: e } = await db()
      .from('te_reconocimiento_visto')
      .upsert([{ reconocimiento_id: id, maestro_id: maestroId }], { onConflict: 'reconocimiento_id,maestro_id', ignoreDuplicates: true })
    fail(e, 'Reconocimiento')
    return
  }
  if (reaccion !== null && !REACCIONES.some((r) => r.clave === reaccion)) throw new TeError('Reacción no válida.')
  const { error: e } = await db()
    .from('te_reconocimiento_visto')
    .upsert([{ reconocimiento_id: id, maestro_id: maestroId, reaccion }], { onConflict: 'reconocimiento_id,maestro_id' })
  fail(e, 'Reconocimiento')
}

export async function snapshot(nivel: TeNivel, niveles: TeNivel[]): Promise<TeSnapshot> {
  const hoy = hoyMx()
  const inicio = inicioCicloEscolar(hoy)
  const [teachers, planRes, capacitaciones, cursos, sugeridos, incRes, clsRes, cfgRes] = await Promise.all([
    equipo(nivel),
    db().from('te_planeacion').select('*').eq('nivel', nivel).gte('semana', inicio).order('semana', { ascending: false }),
    capacitacionesNivel(nivel),
    cursosDe({ nivel }),
    sugeridosDe(nivel, false),
    db().from('te_incidencia').select('*').eq('nivel', nivel).gte('fecha', inicio).order('fecha', { ascending: false }),
    db().from('te_classroom').select('*').eq('nivel', nivel).gte('semana', inicio),
    db().from('te_config').select('ponderadores').eq('nivel', nivel).maybeSingle(),
  ])
  fail(planRes.error, 'Planeaciones')
  fail(incRes.error, 'Incidencias')
  fail(clsRes.error, 'Classroom')
  fail(cfgRes.error, 'Configuración')
  const manuales: TeIncidencia[] = ((incRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    maestro_id: Number(r.maestro_id),
    fecha: String(r.fecha).slice(0, 10),
    tipo: r.tipo as TeIncidencia['tipo'],
    minutos: r.minutos == null ? null : Number(r.minutos),
    justificada: Boolean(r.justificada),
    notas: String(r.notas ?? ''),
    registrado_por: (r.registrado_por as string) ?? null,
    origen: 'manual',
  }))
  const [reloj, reconocimientos] = await Promise.all([
    incidenciasReloj(teachers.filter((t) => t.activo), inicio, hoy),
    reconocimientosDe(nivel, lunesDe(inicio), teachers),
  ])
  const capturadas = new Set(manuales.map((i) => `${i.maestro_id}|${i.fecha}|${i.tipo}`))
  return {
    nivel,
    niveles,
    hoy,
    inicio_ciclo: inicio,
    teachers,
    planeaciones: ((planRes.data ?? []) as Record<string, unknown>[]).map(mapPlaneacion),
    capacitaciones,
    cursos,
    sugeridos,
    reconocimientos,
    incidencias: [...manuales, ...reloj.incidencias.filter((i) => !capturadas.has(`${i.maestro_id}|${i.fecha}|${i.tipo}`))].sort(
      (a, b) => b.fecha.localeCompare(a.fecha),
    ),
    classroom: ((clsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      maestro_id: Number(r.maestro_id),
      semana: String(r.semana).slice(0, 10),
      grupo: String(r.grupo),
      actualizado: Boolean(r.actualizado),
      actividades_calificadas: Boolean(r.actividades_calificadas),
      trabajos_revisados: Boolean(r.trabajos_revisados),
      notas: String(r.notas ?? ''),
      revisado_por: (r.revisado_por as string) ?? null,
    })) as TeClassroom[],
    ponderadores: normalizarPonderadores(cfgRes.data?.ponderadores),
    reloj: reloj.estado,
  }
}

export async function antecedentes(nivel: TeNivel, maestroId: number): Promise<TeAntecedente[]> {
  const { data, error } = await db()
    .from('te_antecedente')
    .select('*')
    .eq('nivel', nivel)
    .eq('maestro_id', maestroId)
    .order('fecha', { ascending: false })
  fail(error, 'Antecedentes')
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    maestro_id: Number(r.maestro_id),
    fecha: String(r.fecha).slice(0, 10),
    tipo: r.tipo as TeAntecedente['tipo'],
    titulo: String(r.titulo),
    descripcion: String(r.descripcion ?? ''),
    archivo_key: (r.archivo_key as string) ?? null,
    archivo_nombre: (r.archivo_nombre as string) ?? null,
    registrado_por: (r.registrado_por as string) ?? null,
    created_at: String(r.created_at ?? ''),
  }))
}

/* ── Archivos ── */

const MIME_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]

export type TipoArchivo = 'cv' | 'foto' | 'antecedente' | 'planeacion' | 'constancia' | 'expediente' | 'curso' | 'evento'

async function subir(tipo: TipoArchivo, nivel: TeNivel, maestroId: number, file: File): Promise<{ key: string; nombre: string }> {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new TeError('Selecciona un archivo.')
  if (file.size > TE_MAX_ARCHIVO_MB * 1024 * 1024) throw new TeError(mensajeArchivoGrande(file.size))
  const soloImagen = tipo === 'foto' || tipo === 'evento'
  if (soloImagen ? !file.type.startsWith('image/') : !MIME_PERMITIDOS.includes(file.type)) {
    throw new TeError(soloImagen ? 'La foto debe ser JPG, PNG o WebP.' : 'Formato no permitido. Usa PDF, Word, PowerPoint, Excel o imagen.')
  }
  const nombre = file.name.slice(0, 180) || 'archivo'
  const seguro = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_')
  const key = `${tipo}/${nivel}/${maestroId}/${Date.now()}-${seguro}`
  const blob = new Blob([await file.arrayBuffer()], { type: file.type })
  const { data, error } = await createInsforgeAdmin().storage.from(TE_BUCKET).upload(key, blob)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo subir el archivo.')
  return { key: data.key ?? key, nombre }
}

async function borrarArchivo(key: string | null | undefined): Promise<void> {
  if (!key) return
  await createInsforgeAdmin().storage.from(TE_BUCKET).remove(key).catch(() => undefined)
}

export async function descargar(key: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  const { data, error } = await createInsforgeAdmin().storage.from(TE_BUCKET).download(key)
  if (error || !data) throw new TeError('Archivo no encontrado.', 404)
  return { bytes: new Uint8Array(await data.arrayBuffer()), tipo: data.type || 'application/octet-stream' }
}

/** El nivel va en la ruta del archivo: `{tipo}/{nivel}/{maestro}/…`. */
export function nivelDeKey(key: string): { nivel: number; maestroId: number; tipo: string } | null {
  const m = /^(cv|foto|antecedente|planeacion|constancia|expediente|curso|evento)\/(\d)\/(\d+)\//.exec(key)
  return m ? { tipo: m[1], nivel: Number(m[2]), maestroId: Number(m[3]) } : null
}

async function asegurarEnEquipo(nivel: TeNivel, maestroId: number): Promise<TeTeacher> {
  const t = (await equipo(nivel)).find((x) => x.maestro_id === maestroId)
  if (!t) throw new TeError('La teacher no pertenece a este equipo.', 404)
  return t
}

async function upsertPerfil(nivel: TeNivel, maestroId: number, cambios: Record<string, unknown>, quien: string): Promise<void> {
  const extra: Record<string, unknown> = {}
  if (!('emoji' in cambios) && !(await perfilActual(maestroId))) extra.emoji = TE_EMOJIS[maestroId % TE_EMOJIS.length]
  const { error } = await db()
    .from('te_teacher')
    .upsert([{ maestro_id: maestroId, nivel, ...extra, ...cambios, updated_by: quien, updated_at: new Date().toISOString() }], { onConflict: 'maestro_id' })
  fail(error, 'Perfil')
}

async function perfilActual(maestroId: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await db().from('te_teacher').select('*').eq('maestro_id', maestroId).maybeSingle()
  fail(error, 'Perfil')
  return (data as Record<string, unknown>) ?? null
}

/* ── Planeación (compartido por directora y teacher) ── */

export async function guardarPlaneacion(opts: {
  nivel: TeNivel
  maestroId: number
  grado: unknown
  semana: unknown
  titulo: unknown
  notas: unknown
  file: File | null
  quien: string
  rol: 'teacher' | 'directora'
  /** JSON del lienzo; undefined = no se toca el que ya había. */
  contenido?: unknown
  /** false = guardar «En construcción» sin mandarla a revisión. */
  enviar?: boolean
}): Promise<void> {
  const t = await asegurarEnEquipo(opts.nivel, opts.maestroId)
  const grado = Number(opts.grado)
  if (!t.grados.includes(grado)) throw new TeError('Ese grado no corresponde a la teacher.')
  const semana = lunesDe(fecha(opts.semana, 'La semana')!)
  const titulo = texto(opts.titulo, 200, 'El título') ?? ''
  const notas = texto(opts.notas, 3000, 'Las notas') ?? ''

  const { data: previa, error } = await db()
    .from('te_planeacion')
    .select('id, archivo_key, archivo_nombre, version, estado, contenido')
    .eq('maestro_id', opts.maestroId)
    .eq('grado', grado)
    .eq('semana', semana)
    .maybeSingle()
  fail(error, 'Planeación')
  if (previa && previa.estado === 'aprobada' && opts.rol === 'teacher') {
    throw new TeError('Esta planeación ya fue aprobada; pide a tu directora que la regrese si necesitas cambiarla.')
  }
  let contenido = (previa?.contenido as TePlaneacion['contenido']) ?? null
  if (opts.contenido !== undefined && opts.contenido !== null && opts.contenido !== '') {
    try {
      contenido = normalizarPlan(typeof opts.contenido === 'string' ? JSON.parse(opts.contenido) : opts.contenido)
    } catch (e) {
      throw new TeError(e instanceof SyntaxError ? 'La planeación no se pudo leer; recarga e intenta de nuevo.' : (e as Error).message)
    }
  }
  const enviar = opts.enviar !== false
  const tieneArchivo = !!opts.file || !!previa?.archivo_key
  if (enviar && !tieneArchivo && !bloquesDePlan(contenido)) {
    throw new TeError('Agrega al menos una actividad en algún día (o adjunta un archivo) antes de enviarla.')
  }
  if (!previa && !opts.file && !contenido) throw new TeError('Construye la planeación o adjunta un archivo.')

  let archivo = { key: (previa?.archivo_key as string) ?? null, nombre: (previa?.archivo_nombre as string) ?? null }
  if (opts.file) {
    const subido = await subir('planeacion', opts.nivel, opts.maestroId, opts.file)
    await borrarArchivo(previa?.archivo_key as string)
    archivo = subido
  }
  const ahora = new Date().toISOString()
  const fila = {
    maestro_id: opts.maestroId,
    nivel: opts.nivel,
    grado,
    semana,
    titulo,
    notas,
    archivo_key: archivo.key,
    archivo_nombre: archivo.nombre,
    contenido,
    estado: enviar ? 'pendiente' : 'borrador',
    version: previa ? Number(previa.version ?? 1) + (enviar && previa.estado !== 'borrador' && previa.estado !== 'pendiente' ? 1 : 0) : 1,
    subido_por: opts.quien,
    subido_rol: opts.rol,
    updated_at: ahora,
  }
  const { error: upErr } = await db().from('te_planeacion').upsert([fila], { onConflict: 'maestro_id,grado,semana' })
  fail(upErr, 'Planeación')
}

/* ── Subidas de la directora ── */

export async function subirArchivoDirectora(nivel: TeNivel, form: FormData, quien: string): Promise<void> {
  const tipo = String(form.get('tipo') ?? '') as TipoArchivo
  const maestroId = entero(form.get('maestro_id'), 'La teacher')
  const file = form.get('archivo') instanceof File ? (form.get('archivo') as File) : null

  if (tipo === 'planeacion') {
    await guardarPlaneacion({
      nivel,
      maestroId,
      grado: form.get('grado'),
      semana: form.get('semana'),
      titulo: form.get('titulo'),
      notas: form.get('notas'),
      file,
      quien,
      rol: 'directora',
    })
    return
  }
  await asegurarEnEquipo(nivel, maestroId)
  if (!file) throw new TeError('Selecciona un archivo.')

  if (tipo === 'cv' || tipo === 'foto') {
    const previo = await perfilActual(maestroId)
    const subido = await subir(tipo, nivel, maestroId, file)
    await upsertPerfil(nivel, maestroId, tipo === 'cv' ? { cv_key: subido.key, cv_nombre: subido.nombre } : { foto_key: subido.key }, quien)
    await borrarArchivo((tipo === 'cv' ? previo?.cv_key : previo?.foto_key) as string)
    return
  }
  if (tipo === 'antecedente') {
    const subido = await subir('antecedente', nivel, maestroId, file)
    const id = entero(form.get('antecedente_id'), 'El antecedente')
    const { data: prev } = await db().from('te_antecedente').select('archivo_key').eq('id', id).eq('maestro_id', maestroId).maybeSingle()
    const { error } = await db().from('te_antecedente').update({ archivo_key: subido.key, archivo_nombre: subido.nombre }).eq('id', id).eq('maestro_id', maestroId)
    fail(error, 'Antecedente')
    await borrarArchivo(prev?.archivo_key as string)
    return
  }
  if (tipo === 'expediente') {
    const itemId = entero(form.get('item_id'), 'El registro')
    const { data: prev, error: e1 } = await db()
      .from('te_expediente_item')
      .select('tipo, archivo_key')
      .eq('id', itemId)
      .eq('maestro_id', maestroId)
      .eq('nivel', nivel)
      .maybeSingle()
    fail(e1, 'Expediente')
    if (!prev) throw new TeError('Registro no encontrado.', 404)
    if (!TIPOS_ITEM[prev.tipo as TipoItemExpediente]?.archivo) throw new TeError('Ese registro no lleva archivo.')
    const subido = await subir('expediente', nivel, maestroId, file)
    const { error } = await db()
      .from('te_expediente_item')
      .update({ archivo_key: subido.key, archivo_nombre: subido.nombre, updated_at: new Date().toISOString() })
      .eq('id', itemId)
    fail(error, 'Expediente')
    await borrarArchivo(prev.archivo_key as string)
    return
  }
  if (tipo === 'constancia') {
    const capId = entero(form.get('capacitacion_id'), 'La capacitación')
    const subido = await subir('constancia', nivel, maestroId, file)
    const { data: prev } = await db()
      .from('te_capacitacion_teacher')
      .select('constancia_key')
      .eq('capacitacion_id', capId)
      .eq('maestro_id', maestroId)
      .maybeSingle()
    const { error } = await db()
      .from('te_capacitacion_teacher')
      .upsert([{ capacitacion_id: capId, maestro_id: maestroId, constancia_key: subido.key, constancia_nombre: subido.nombre }], {
        onConflict: 'capacitacion_id,maestro_id',
      })
    fail(error, 'Constancia')
    await borrarArchivo(prev?.constancia_key as string)
    return
  }
  throw new TeError('Tipo de archivo no válido.')
}

/* ── Expediente personal ── */

function validarCampos(raw: unknown, campos: TeCampo[]): Record<string, string> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const c of campos) {
    let v = String(o[c.clave] ?? '').trim()
    if (!v) {
      if (c.requerido) throw new TeError(`${c.etiqueta} es obligatorio.`)
      continue
    }
    if (c.mayusculas) v = v.toUpperCase()
    if (c.tipo === 'date') v = fecha(v, c.etiqueta)!
    else if (c.tipo === 'number') {
      if (!/^\d+$/.test(v) || v.length > (c.max ?? 6)) throw new TeError(`${c.etiqueta} debe ser un número.`)
    } else if (c.tipo === 'select') {
      if (!c.opciones?.includes(v)) throw new TeError(`${c.etiqueta}: opción no válida.`)
    } else {
      if (v.length > (c.max ?? 500)) throw new TeError(`${c.etiqueta}: máximo ${c.max ?? 500} caracteres.`)
      if (c.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new TeError(`${c.etiqueta} no es válido.`)
      if (c.tipo === 'tel' && !/^[\d\s()+-]{7,20}$/.test(v)) throw new TeError(`${c.etiqueta} no es válido.`)
    }
    if (c.patron && !c.patron.test(v)) throw new TeError(`${c.etiqueta} no tiene el formato correcto.`)
    out[c.clave] = v
  }
  return out
}

function filaItem(r: Record<string, unknown>): TeExpedienteItem {
  return {
    id: Number(r.id),
    maestro_id: Number(r.maestro_id),
    tipo: r.tipo as TipoItemExpediente,
    datos: (r.datos ?? {}) as Record<string, string>,
    archivo_key: (r.archivo_key as string) ?? null,
    archivo_nombre: (r.archivo_nombre as string) ?? null,
    registrado_por: (r.registrado_por as string) ?? null,
    updated_at: String(r.updated_at ?? ''),
  }
}

async function expediente(nivel: TeNivel, maestroId: number): Promise<TeExpediente> {
  const [gen, items] = await Promise.all([
    db().from('te_expediente').select('datos, updated_at, updated_by').eq('maestro_id', maestroId).eq('nivel', nivel).maybeSingle(),
    db().from('te_expediente_item').select('*').eq('maestro_id', maestroId).eq('nivel', nivel).order('created_at'),
  ])
  fail(gen.error, 'Expediente')
  fail(items.error, 'Expediente')
  return {
    maestro_id: maestroId,
    general: (gen.data?.datos ?? {}) as Record<string, string>,
    actualizado: (gen.data?.updated_at as string) ?? null,
    actualizado_por: (gen.data?.updated_by as string) ?? null,
    items: ((items.data ?? []) as Record<string, unknown>[]).map(filaItem),
  }
}

async function directorio(nivel: TeNivel): Promise<TeDirectorioFila[]> {
  const [gen, items] = await Promise.all([
    db().from('te_expediente').select('maestro_id, datos').eq('nivel', nivel),
    db().from('te_expediente_item').select('maestro_id, tipo').eq('nivel', nivel),
  ])
  fail(gen.error, 'Expedientes')
  fail(items.error, 'Expedientes')
  const filas = new Map<number, TeDirectorioFila>()
  const fila = (id: number) => {
    if (!filas.has(id)) filas.set(id, { maestro_id: id, general: {}, items: {} })
    return filas.get(id)!
  }
  for (const g of (gen.data ?? []) as Record<string, unknown>[]) fila(Number(g.maestro_id)).general = (g.datos ?? {}) as Record<string, string>
  for (const it of (items.data ?? []) as Record<string, unknown>[]) {
    const f = fila(Number(it.maestro_id))
    const t = it.tipo as TipoItemExpediente
    f.items[t] = (f.items[t] ?? 0) + 1
  }
  return [...filas.values()]
}

/* ── Acciones JSON de la directora ── */

const TIPOS_ANT = new Set<string>(TIPOS_ANTECEDENTE.map((t) => t.valor))
const TIPOS_INC = new Set<string>(TIPOS_INCIDENCIA.map((t) => t.valor))

export async function accion(nivel: TeNivel, body: Record<string, unknown>, quien: string): Promise<unknown> {
  const a = String(body.accion ?? '')
  const ahora = new Date().toISOString()

  switch (a) {
    case 'perfil': {
      const id = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, id)
      const emoji = texto(body.emoji, 16, 'El emoji') ?? '🌷'
      await upsertPerfil(
        nivel,
        id,
        {
          emoji,
          puesto: texto(body.puesto, 120, 'El puesto'),
          fecha_ingreso: fecha(body.fecha_ingreso, 'La fecha de ingreso', false),
          telefono: texto(body.telefono, 40, 'El teléfono'),
          formacion: texto(body.formacion, 2000, 'La formación'),
          certificaciones: texto(body.certificaciones, 2000, 'Las certificaciones'),
          nivel_ingles: texto(body.nivel_ingles, 40, 'El nivel de inglés'),
          notas: texto(body.notas, 4000, 'Las notas'),
        },
        quien
      )
      return { ok: true }
    }
    case 'agregar_teacher': {
      const id = entero(body.maestro_id, 'La maestra')
      const { data, error } = await db().from('boleta_maestro').select('maestro_id, maestro_nivel').eq('maestro_id', id).maybeSingle()
      fail(error, 'Maestro')
      if (!data || Number(data.maestro_nivel) !== nivel) throw new TeError('La maestra no es de este nivel.')
      await upsertPerfil(nivel, id, { manual: true, activo: true }, quien)
      return { ok: true }
    }
    case 'activo': {
      const id = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, id)
      await upsertPerfil(nivel, id, { activo: Boolean(body.activo) }, quien)
      return { ok: true }
    }
    case 'quitar_archivo_perfil': {
      const id = entero(body.maestro_id, 'La teacher')
      const campo = body.campo === 'foto' ? 'foto' : 'cv'
      const previo = await perfilActual(id)
      if (!previo || Number(previo.nivel) !== nivel) throw new TeError('Perfil no encontrado.', 404)
      await upsertPerfil(nivel, id, campo === 'cv' ? { cv_key: null, cv_nombre: null } : { foto_key: null }, quien)
      await borrarArchivo((campo === 'cv' ? previo.cv_key : previo.foto_key) as string)
      return { ok: true }
    }
    case 'antecedentes': {
      const id = entero(body.maestro_id, 'La teacher')
      return { antecedentes: await antecedentes(nivel, id) }
    }
    case 'antecedente': {
      const id = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, id)
      const tipo = String(body.tipo ?? '')
      if (!TIPOS_ANT.has(tipo)) throw new TeError('Tipo de antecedente no válido.')
      const { data, error } = await db()
        .from('te_antecedente')
        .insert([
          {
            maestro_id: id,
            nivel,
            fecha: fecha(body.fecha, 'La fecha'),
            tipo,
            titulo: texto(body.titulo, 200, 'El título', true),
            descripcion: texto(body.descripcion, 5000, 'La descripción') ?? '',
            registrado_por: quien,
          },
        ])
        .select('id')
        .single()
      fail(error, 'Antecedente')
      return { id: Number(data?.id) }
    }
    case 'eliminar_antecedente': {
      const id = entero(body.id, 'El antecedente')
      const { data } = await db().from('te_antecedente').select('archivo_key').eq('id', id).eq('nivel', nivel).maybeSingle()
      const { error } = await db().from('te_antecedente').delete().eq('id', id).eq('nivel', nivel)
      fail(error, 'Antecedente')
      await borrarArchivo(data?.archivo_key as string)
      return { ok: true }
    }
    case 'revisar_planeacion': {
      const id = entero(body.id, 'La planeación')
      const estado = String(body.estado ?? '')
      if (!(estado in ESTADOS_PLANEACION) || estado === 'borrador') throw new TeError('Estado no válido.')
      const comentario = texto(body.comentario, 3000, 'El comentario') ?? ''
      const { data: actual } = await db().from('te_planeacion').select('estado').eq('id', id).eq('nivel', nivel).maybeSingle()
      if (actual?.estado === 'borrador') throw new TeError('La teacher aún no envía esta planeación; sigue en construcción.')
      if (estado === 'cambios' && !comentario) throw new TeError('Escribe qué cambios necesita la planeación.')
      const { error } = await db()
        .from('te_planeacion')
        .update({ estado, comentario, revisado_por: estado === 'pendiente' ? null : quien, revisado_at: estado === 'pendiente' ? null : ahora, updated_at: ahora })
        .eq('id', id)
        .eq('nivel', nivel)
      fail(error, 'Planeación')
      return { ok: true }
    }
    case 'eliminar_planeacion': {
      const id = entero(body.id, 'La planeación')
      const { data } = await db().from('te_planeacion').select('archivo_key').eq('id', id).eq('nivel', nivel).maybeSingle()
      const { error } = await db().from('te_planeacion').delete().eq('id', id).eq('nivel', nivel)
      fail(error, 'Planeación')
      await borrarArchivo(data?.archivo_key as string)
      return { ok: true }
    }
    case 'revisar_curso': {
      const id = entero(body.id, 'El curso')
      const estado = String(body.estado ?? '')
      if (!(estado in ESTADOS_CURSO)) throw new TeError('Estado no válido.')
      const comentario = texto(body.comentario, 2000, 'El comentario') ?? ''
      if (estado === 'rechazado' && !comentario) throw new TeError('Escribe por qué se rechaza para que la teacher lo corrija.')
      const { data, error } = await db()
        .from('te_curso')
        .update({ estado, comentario, revisado_por: estado === 'pendiente' ? null : quien, revisado_at: estado === 'pendiente' ? null : ahora, updated_at: ahora })
        .eq('id', id)
        .eq('nivel', nivel)
        .select('id')
      fail(error, 'Curso')
      if (!data?.length) throw new TeError('Curso no encontrado.', 404)
      return { ok: true }
    }
    case 'eliminar_curso': {
      const id = entero(body.id, 'El curso')
      const { data } = await db().from('te_curso').select('archivo_key').eq('id', id).eq('nivel', nivel).maybeSingle()
      if (!data) throw new TeError('Curso no encontrado.', 404)
      const { error } = await db().from('te_curso').delete().eq('id', id).eq('nivel', nivel)
      fail(error, 'Curso')
      await borrarArchivo(data.archivo_key as string)
      return { ok: true }
    }
    case 'curso_sugerido': {
      const modalidad = String(body.modalidad ?? 'en_linea')
      if (!(modalidad in MODALIDADES)) throw new TeError('Modalidad no válida.')
      const costo = String(body.costo ?? 'gratis')
      if (!(costo in COSTOS_SUGERIDO)) throw new TeError('Costo no válido.')
      const skill = body.skill ? String(body.skill) : null
      if (skill && !SKILLS.some((s) => s.clave === skill)) throw new TeError('Materia no válida.')
      const horas = body.horas === '' || body.horas == null ? null : Number(body.horas)
      if (horas != null && (!Number.isFinite(horas) || horas < 0 || horas > 2000)) throw new TeError('Horas no válidas.')
      const fila = {
        nivel,
        titulo: texto(body.titulo, 200, 'El nombre del curso', true),
        institucion: texto(body.institucion, 200, 'La institución'),
        modalidad,
        enlace: enlaceHttps(body.enlace),
        skill,
        costo,
        horas,
        descripcion: texto(body.descripcion, 600, 'La descripción') ?? '',
        activo: body.activo !== false,
        updated_at: ahora,
      }
      if (body.id) {
        const { data, error } = await db().from('te_curso_sugerido').update(fila).eq('id', entero(body.id, 'El curso')).eq('nivel', nivel).select('id')
        fail(error, 'Curso sugerido')
        if (!data?.length) throw new TeError('Curso no encontrado.', 404)
        return { ok: true }
      }
      const { error } = await db().from('te_curso_sugerido').insert([{ ...fila, creado_por: quien }])
      fail(error, 'Curso sugerido')
      return { ok: true }
    }
    case 'eliminar_reconocimiento': {
      const id = entero(body.id, 'El reconocimiento')
      const { data } = await db().from('te_reconocimiento').select('foto_key').eq('id', id).eq('nivel', nivel).maybeSingle()
      if (!data) throw new TeError('Reconocimiento no encontrado.', 404)
      const { error } = await db().from('te_reconocimiento').delete().eq('id', id).eq('nivel', nivel)
      fail(error, 'Reconocimiento')
      await borrarArchivo(data.foto_key as string)
      return { ok: true }
    }
    case 'eliminar_curso_sugerido': {
      const { error } = await db().from('te_curso_sugerido').delete().eq('id', entero(body.id, 'El curso')).eq('nivel', nivel)
      fail(error, 'Curso sugerido')
      return { ok: true }
    }
    case 'capacitacion': {
      const tipo = body.tipo === 'externa' ? 'externa' : 'interna'
      const modalidad = String(body.modalidad ?? 'presencial')
      if (!(modalidad in MODALIDADES)) throw new TeError('Modalidad no válida.')
      const estado = String(body.estado ?? 'programada')
      if (!['programada', 'realizada', 'cancelada'].includes(estado)) throw new TeError('Estado no válido.')
      const inicio = fecha(body.fecha_inicio, 'La fecha de inicio')!
      const fin = fecha(body.fecha_fin, 'La fecha de fin', false)
      if (fin && fin < inicio) throw new TeError('La fecha de fin no puede ser antes del inicio.')
      const horas = body.horas === '' || body.horas == null ? null : Number(body.horas)
      if (horas != null && (!Number.isFinite(horas) || horas < 0 || horas > 2000)) throw new TeError('Horas no válidas.')
      const fila = {
        nivel,
        titulo: texto(body.titulo, 200, 'El nombre', true),
        tipo,
        modalidad,
        proveedor: texto(body.proveedor, 200, 'El proveedor'),
        fecha_inicio: inicio,
        fecha_fin: fin,
        horas,
        lugar: texto(body.lugar, 200, 'El lugar'),
        descripcion: texto(body.descripcion, 3000, 'La descripción') ?? '',
        estado,
        registrado_por: quien,
        updated_at: ahora,
      }
      let capId = body.id ? entero(body.id, 'La capacitación') : 0
      if (capId) {
        const { error } = await db().from('te_capacitacion').update(fila).eq('id', capId).eq('nivel', nivel)
        fail(error, 'Capacitación')
      } else {
        const { data, error } = await db().from('te_capacitacion').insert([fila]).select('id').single()
        fail(error, 'Capacitación')
        capId = Number(data?.id)
      }
      const equipoIds = new Set((await equipo(nivel)).map((t) => t.maestro_id))
      const participantes = Array.isArray(body.participantes) ? (body.participantes as Record<string, unknown>[]) : []
      const filas = participantes
        .map((p) => ({ maestro_id: Number(p.maestro_id), asistio: p.asistio == null ? null : Boolean(p.asistio) }))
        .filter((p) => equipoIds.has(p.maestro_id))
      const { data: previos, error: pErr } = await db().from('te_capacitacion_teacher').select('maestro_id, constancia_key').eq('capacitacion_id', capId)
      fail(pErr, 'Participantes')
      const quedan = new Set(filas.map((f) => f.maestro_id))
      const salen = ((previos ?? []) as { maestro_id: number; constancia_key: string | null }[]).filter((p) => !quedan.has(Number(p.maestro_id)))
      if (salen.length) {
        const { error } = await db()
          .from('te_capacitacion_teacher')
          .delete()
          .eq('capacitacion_id', capId)
          .in('maestro_id', salen.map((s) => Number(s.maestro_id)))
        fail(error, 'Participantes')
        for (const s of salen) await borrarArchivo(s.constancia_key)
      }
      if (filas.length) {
        const { error } = await db()
          .from('te_capacitacion_teacher')
          .upsert(filas.map((f) => ({ capacitacion_id: capId, ...f })), { onConflict: 'capacitacion_id,maestro_id' })
        fail(error, 'Participantes')
      }
      return { id: capId }
    }
    case 'eliminar_capacitacion': {
      const id = entero(body.id, 'La capacitación')
      const { data: parts } = await db().from('te_capacitacion_teacher').select('constancia_key').eq('capacitacion_id', id)
      const { error } = await db().from('te_capacitacion').delete().eq('id', id).eq('nivel', nivel)
      fail(error, 'Capacitación')
      for (const p of (parts ?? []) as { constancia_key: string | null }[]) await borrarArchivo(p.constancia_key)
      return { ok: true }
    }
    case 'incidencia': {
      const id = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, id)
      const tipo = String(body.tipo ?? '')
      if (!TIPOS_INC.has(tipo)) throw new TeError('Tipo de incidencia no válido.')
      const minutos = body.minutos === '' || body.minutos == null ? null : Number(body.minutos)
      if (minutos != null && (!Number.isInteger(minutos) || minutos < 0 || minutos > 600)) throw new TeError('Minutos no válidos.')
      const fila = {
        maestro_id: id,
        nivel,
        fecha: fecha(body.fecha, 'La fecha'),
        tipo,
        minutos,
        justificada: Boolean(body.justificada),
        notas: texto(body.notas, 1000, 'Las notas') ?? '',
        registrado_por: quien,
      }
      const { error } = await db().from('te_incidencia').upsert([fila], { onConflict: 'maestro_id,fecha,tipo' })
      fail(error, 'Incidencia')
      return { ok: true }
    }
    case 'eliminar_incidencia': {
      const id = entero(body.id, 'La incidencia')
      const { error } = await db().from('te_incidencia').delete().eq('id', id).eq('nivel', nivel)
      fail(error, 'Incidencia')
      return { ok: true }
    }
    case 'ponderadores': {
      const p = normalizarPonderadores(body.ponderadores)
      const suma = RUBROS.reduce((s, r) => s + p[r.clave], 0)
      if (suma !== 100) throw new TeError(`Los ponderadores deben sumar 100% (ahora suman ${suma}%).`)
      const { error } = await db().from('te_config').upsert([{ nivel, ponderadores: p, updated_by: quien, updated_at: ahora }], { onConflict: 'nivel' })
      fail(error, 'Ponderadores')
      return { ok: true }
    }
    case 'classroom': {
      const id = entero(body.maestro_id, 'La teacher')
      const t = await asegurarEnEquipo(nivel, id)
      const grupo = String(body.grupo ?? '').trim().toUpperCase()
      if (!grupo || grupo.length > 10 || (t.grupos.length && !t.grupos.includes(grupo))) throw new TeError('Grupo no válido.')
      const fila = {
        maestro_id: id,
        nivel,
        semana: lunesDe(fecha(body.semana, 'La semana')!),
        grupo,
        actualizado: Boolean(body.actualizado),
        actividades_calificadas: Boolean(body.actividades_calificadas),
        trabajos_revisados: Boolean(body.trabajos_revisados),
        notas: texto(body.notas, 1000, 'Las notas') ?? '',
        revisado_por: quien,
        updated_at: ahora,
      }
      const { error } = await db().from('te_classroom').upsert([fila], { onConflict: 'maestro_id,semana,grupo' })
      fail(error, 'Classroom')
      return { ok: true }
    }
    case 'candidatos':
      return { candidatos: await candidatos(nivel) }
    case 'expediente': {
      const id = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, id)
      return { expediente: await expediente(nivel, id) }
    }
    case 'directorio':
      return { directorio: await directorio(nivel) }
    case 'guardar_expediente': {
      const id = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, id)
      const datos = validarCampos(body.datos, CAMPOS_GENERALES)
      const { error } = await db()
        .from('te_expediente')
        .upsert([{ maestro_id: id, nivel, datos, updated_by: quien, updated_at: ahora }], { onConflict: 'maestro_id' })
      fail(error, 'Expediente')
      return { ok: true }
    }
    case 'borrar_expediente': {
      const id = entero(body.maestro_id, 'La teacher')
      const { error } = await db().from('te_expediente').delete().eq('maestro_id', id).eq('nivel', nivel)
      fail(error, 'Expediente')
      return { ok: true }
    }
    case 'expediente_item': {
      const maestroId = entero(body.maestro_id, 'La teacher')
      await asegurarEnEquipo(nivel, maestroId)
      const tipo = String(body.tipo ?? '') as TipoItemExpediente
      const def = TIPOS_ITEM[tipo]
      if (!def) throw new TeError('Tipo de registro no válido.')
      const datos = validarCampos(body.datos, def.campos)
      if (body.id) {
        const itemId = entero(body.id, 'El registro')
        const { data, error } = await db()
          .from('te_expediente_item')
          .update({ datos, updated_at: ahora, registrado_por: quien })
          .eq('id', itemId)
          .eq('maestro_id', maestroId)
          .eq('nivel', nivel)
          .eq('tipo', tipo)
          .select('id')
        fail(error, 'Expediente')
        if (!data?.length) throw new TeError('Registro no encontrado.', 404)
        return { id: itemId }
      }
      const { data, error } = await db()
        .from('te_expediente_item')
        .insert([{ maestro_id: maestroId, nivel, tipo, datos, registrado_por: quien }])
        .select('id')
        .single()
      fail(error, 'Expediente')
      return { id: Number(data?.id) }
    }
    case 'eliminar_expediente_item': {
      const itemId = entero(body.id, 'El registro')
      const { data } = await db().from('te_expediente_item').select('archivo_key').eq('id', itemId).eq('nivel', nivel).maybeSingle()
      const { error } = await db().from('te_expediente_item').delete().eq('id', itemId).eq('nivel', nivel)
      fail(error, 'Expediente')
      await borrarArchivo(data?.archivo_key as string)
      return { ok: true }
    }
    case 'quitar_archivo_item': {
      const itemId = entero(body.id, 'El registro')
      const { data } = await db().from('te_expediente_item').select('archivo_key').eq('id', itemId).eq('nivel', nivel).maybeSingle()
      if (!data) throw new TeError('Registro no encontrado.', 404)
      const { error } = await db().from('te_expediente_item').update({ archivo_key: null, archivo_nombre: null, updated_at: ahora }).eq('id', itemId)
      fail(error, 'Expediente')
      await borrarArchivo(data.archivo_key as string)
      return { ok: true }
    }
    default:
      throw new TeError('Acción no válida.')
  }
}

/* ── Portal de la teacher ── */

export async function equipoDeTeacher(maestroId: number): Promise<{ nivel: TeNivel; teacher: TeTeacher } | null> {
  for (const nivel of [3] as TeNivel[]) {
    const t = (await equipo(nivel, false)).find((x) => x.maestro_id === maestroId)
    if (t) return { nivel, teacher: t }
  }
  return null
}

export async function portalTeacher(maestroId: number) {
  const r = await equipoDeTeacher(maestroId)
  if (!r) throw new TeError('Tu usuario no está en un equipo de inglés.', 403)
  const hoy = hoyMx()
  const desde = sumarDias(lunesDe(hoy), -7 * 12)
  const [planRes, capacitaciones, cursos, sugeridos, reconocimientos] = await Promise.all([
    db().from('te_planeacion').select('*').eq('maestro_id', maestroId).gte('semana', desde).order('semana', { ascending: false }),
    capacitacionesNivel(r.nivel, maestroId),
    cursosDe({ maestroId }),
    sugeridosDe(r.nivel, true),
    equipo(r.nivel).then((t) => reconocimientosDe(r.nivel, sumarDias(lunesDe(hoy), -7 * 8), t)),
  ])
  fail(planRes.error, 'Planeaciones')
  return {
    nivel: r.nivel,
    hoy,
    teacher: { maestro_id: r.teacher.maestro_id, nombre: r.teacher.nombre, emoji: r.teacher.emoji, grupos: r.teacher.grupos, grados: r.teacher.grados },
    planeaciones: ((planRes.data ?? []) as Record<string, unknown>[]).map(mapPlaneacion),
    capacitaciones: capacitaciones.map((c) => ({ ...c, participantes: c.participantes.filter((p) => p.maestro_id === maestroId) })),
    cursos,
    sugeridos,
    reconocimientos,
  }
}

/** La teacher sube un curso nuevo o corrige uno rechazado (vuelve a «Por validar»). */
export async function guardarCursoTeacher(nivel: TeNivel, maestroId: number, form: FormData): Promise<void> {
  const file = form.get('archivo') instanceof File ? (form.get('archivo') as File) : null
  const modalidad = String(form.get('modalidad') ?? 'en_linea')
  if (!(modalidad in MODALIDADES)) throw new TeError('Modalidad no válida.')
  const fechaCurso = fecha(form.get('fecha'), 'La fecha')!
  if (fechaCurso > hoyMx()) throw new TeError('La fecha del curso no puede ser futura; súbelo cuando lo termines.')
  const horasRaw = form.get('horas')
  const horas = horasRaw == null || horasRaw === '' ? null : Number(horasRaw)
  if (horas != null && (!Number.isFinite(horas) || horas < 0 || horas > 2000)) throw new TeError('Horas no válidas.')
  const campos = {
    titulo: texto(form.get('titulo'), 200, 'El nombre del curso', true),
    institucion: texto(form.get('institucion'), 200, 'La institución'),
    modalidad,
    fecha: fechaCurso,
    horas,
    notas: texto(form.get('notas'), 2000, 'Las notas') ?? '',
  }
  const ahora = new Date().toISOString()
  const idRaw = form.get('id')

  if (idRaw) {
    const id = entero(idRaw, 'El curso')
    const { data: previo, error } = await db().from('te_curso').select('estado, archivo_key').eq('id', id).eq('maestro_id', maestroId).maybeSingle()
    fail(error, 'Curso')
    if (!previo) throw new TeError('Curso no encontrado.', 404)
    if (previo.estado === 'validado') throw new TeError('Este curso ya fue validado; pide a tu directora que lo regrese si necesitas cambiarlo.')
    const subido = file ? await subir('curso', nivel, maestroId, file) : null
    const { error: upErr } = await db()
      .from('te_curso')
      .update({
        ...campos,
        ...(subido ? { archivo_key: subido.key, archivo_nombre: subido.nombre } : {}),
        estado: 'pendiente',
        revisado_por: null,
        revisado_at: null,
        updated_at: ahora,
      })
      .eq('id', id)
      .eq('maestro_id', maestroId)
    fail(upErr, 'Curso')
    if (subido) await borrarArchivo(previo.archivo_key as string)
    return
  }

  if (!file) throw new TeError('Adjunta la constancia o diploma del curso.')
  const subido = await subir('curso', nivel, maestroId, file)
  const { error } = await db()
    .from('te_curso')
    .insert([{ maestro_id: maestroId, nivel, ...campos, archivo_key: subido.key, archivo_nombre: subido.nombre }])
  if (error) await borrarArchivo(subido.key)
  fail(error, 'Curso')
}

export async function eliminarCursoTeacher(maestroId: number, id: number): Promise<void> {
  const { data, error } = await db().from('te_curso').select('estado, archivo_key').eq('id', id).eq('maestro_id', maestroId).maybeSingle()
  fail(error, 'Curso')
  if (!data) throw new TeError('Curso no encontrado.', 404)
  if (data.estado === 'validado') throw new TeError('Un curso validado ya no se puede borrar; pídeselo a tu directora.')
  const { error: delErr } = await db().from('te_curso').delete().eq('id', id).eq('maestro_id', maestroId)
  fail(delErr, 'Curso')
  await borrarArchivo(data.archivo_key as string)
}

/** `simulado_por`: nombre de quien está en vista previa (coording, laura, mario), o null si es la teacher. */
export type PortalTeacherData = Awaited<ReturnType<typeof portalTeacher>> & { simulado_por?: string | null }
