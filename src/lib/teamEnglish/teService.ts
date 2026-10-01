import { createDbAdmin, createInsforgeAdmin } from '@/lib/insforgeAdmin'
import {
  ESTADOS_PLANEACION,
  MODALIDADES,
  RUBROS,
  TE_EMOJIS,
  TE_MAX_ARCHIVO_MB,
  TIPOS_ANTECEDENTE,
  TIPOS_INCIDENCIA,
  gradosNivel,
  hoyMx,
  inicioCicloEscolar,
  lunesDe,
  normalizarPonderadores,
  sumarDias,
  type TeAntecedente,
  type TeCapacitacion,
  type TeClassroom,
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

/** Solo inglés Primaria: su directora más sistemas y dirección general. */
const NIVELES_POR_USUARIO: Record<number, TeNivel[]> = {
  10: [3], // coording · inglés primaria
  2: [3], // laura
  17: [3], // mario
  59: [3], // santiago (DG)
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

export async function snapshot(nivel: TeNivel, niveles: TeNivel[]): Promise<TeSnapshot> {
  const hoy = hoyMx()
  const inicio = inicioCicloEscolar(hoy)
  const [teachers, planRes, capacitaciones, incRes, clsRes, cfgRes] = await Promise.all([
    equipo(nivel),
    db().from('te_planeacion').select('*').eq('nivel', nivel).gte('semana', inicio).order('semana', { ascending: false }),
    capacitacionesNivel(nivel),
    db().from('te_incidencia').select('*').eq('nivel', nivel).gte('fecha', inicio).order('fecha', { ascending: false }),
    db().from('te_classroom').select('*').eq('nivel', nivel).gte('semana', inicio),
    db().from('te_config').select('ponderadores').eq('nivel', nivel).maybeSingle(),
  ])
  fail(planRes.error, 'Planeaciones')
  fail(incRes.error, 'Incidencias')
  fail(clsRes.error, 'Classroom')
  fail(cfgRes.error, 'Configuración')
  return {
    nivel,
    niveles,
    hoy,
    inicio_ciclo: inicio,
    teachers,
    planeaciones: ((planRes.data ?? []) as Record<string, unknown>[]).map(mapPlaneacion),
    capacitaciones,
    incidencias: ((incRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      maestro_id: Number(r.maestro_id),
      fecha: String(r.fecha).slice(0, 10),
      tipo: r.tipo as TeIncidencia['tipo'],
      minutos: r.minutos == null ? null : Number(r.minutos),
      justificada: Boolean(r.justificada),
      notas: String(r.notas ?? ''),
      registrado_por: (r.registrado_por as string) ?? null,
    })),
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

export type TipoArchivo = 'cv' | 'foto' | 'antecedente' | 'planeacion' | 'constancia'

async function subir(tipo: TipoArchivo, nivel: TeNivel, maestroId: number, file: File): Promise<{ key: string; nombre: string }> {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new TeError('Selecciona un archivo.')
  if (file.size > TE_MAX_ARCHIVO_MB * 1024 * 1024) throw new TeError(`El archivo pesa más de ${TE_MAX_ARCHIVO_MB} MB.`)
  const soloImagen = tipo === 'foto'
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
  const m = /^(cv|foto|antecedente|planeacion|constancia)\/(\d)\/(\d+)\//.exec(key)
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
}): Promise<void> {
  const t = await asegurarEnEquipo(opts.nivel, opts.maestroId)
  const grado = Number(opts.grado)
  if (!t.grados.includes(grado)) throw new TeError('Ese grado no corresponde a la teacher.')
  const semana = lunesDe(fecha(opts.semana, 'La semana')!)
  const titulo = texto(opts.titulo, 200, 'El título') ?? ''
  const notas = texto(opts.notas, 3000, 'Las notas') ?? ''

  const { data: previa, error } = await db()
    .from('te_planeacion')
    .select('id, archivo_key, archivo_nombre, version, estado')
    .eq('maestro_id', opts.maestroId)
    .eq('grado', grado)
    .eq('semana', semana)
    .maybeSingle()
  fail(error, 'Planeación')
  if (previa && previa.estado === 'aprobada' && opts.rol === 'teacher') {
    throw new TeError('Esta planeación ya fue aprobada; pide a tu directora que la regrese si necesitas cambiarla.')
  }
  if (!previa && !opts.file) throw new TeError('Adjunta el archivo de la planeación.')

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
    estado: 'pendiente',
    version: previa ? Number(previa.version ?? 1) + (opts.file ? 1 : 0) : 1,
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
      if (!(estado in ESTADOS_PLANEACION)) throw new TeError('Estado no válido.')
      const comentario = texto(body.comentario, 3000, 'El comentario') ?? ''
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
  const [planRes, capacitaciones] = await Promise.all([
    db().from('te_planeacion').select('*').eq('maestro_id', maestroId).gte('semana', desde).order('semana', { ascending: false }),
    capacitacionesNivel(r.nivel, maestroId),
  ])
  fail(planRes.error, 'Planeaciones')
  return {
    nivel: r.nivel,
    hoy,
    teacher: { maestro_id: r.teacher.maestro_id, nombre: r.teacher.nombre, emoji: r.teacher.emoji, grupos: r.teacher.grupos, grados: r.teacher.grados },
    planeaciones: ((planRes.data ?? []) as Record<string, unknown>[]).map(mapPlaneacion),
    capacitaciones: capacitaciones.map((c) => ({ ...c, participantes: c.participantes.filter((p) => p.maestro_id === maestroId) })),
  }
}

export type PortalTeacherData = Awaited<ReturnType<typeof portalTeacher>>
