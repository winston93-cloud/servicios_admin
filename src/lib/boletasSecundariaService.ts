import { md5Hex } from './boletasAuth'
import { listarEntregas, entregaVacia, type BoletaEntrega } from './boletasEntrega'
import { createBoletasDb } from './boletasInsforge'
import { listarPublicaciones, publicacionAplica } from './boletasPortal'
import {
  BOLETAS_NIVEL_SEC,
  SECUNDARIA_GRUPOS,
  SIN_CALIFICACION,
  califABd,
  califDesdeBd,
  esGradoSecundaria,
  esGrupoSecundaria,
  esMesComprension,
  etiquetaGrupoSec,
  grupoNumeroSec,
  letraGrupoSec,
  normalizarCalifSec,
  normalizarComprension,
  normalizarConducta,
  normalizarFaltas,
  promedioMateria,
  truncar,
  type SecundariaGrado,
  type SecundariaSeccion,
} from './boletasSecundariaCatalog'

export * from './boletasSecundariaCatalog'

/** Secundaria (nivel 4): catálogo, maestros/asignaciones, hoja de captura por materia y grupo, entregas y promedios. */

export const MODULO_SECUNDARIA = 'secundaria' as const

type Row = Record<string, unknown>

function fail(error: { message?: string } | null, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message ?? 'error'}`)
}

function txt(v: unknown): string {
  return String(v ?? '').trim()
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def
}

const PAGINA = 1000
const TROZO_IDS = 150

/** PostgREST corta en 1000 filas: trozos de ids y páginas hasta agotar (la consulta debe ir ordenada). */
export async function filasPorIds(
  ids: number[],
  consulta: (trozo: number[], desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  contexto: string
): Promise<Row[]> {
  const unicos = [...new Set(ids)]
  const out: Row[] = []
  for (let i = 0; i < unicos.length; i += TROZO_IDS) {
    const trozo = unicos.slice(i, i + TROZO_IDS)
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await consulta(trozo, desde, desde + PAGINA - 1)
      fail(error, contexto)
      const filas = (data ?? []) as Row[]
      out.push(...filas)
      if (filas.length < PAGINA) break
    }
  }
  return out
}

// ── Materias ────────────────────────────────────────────────────────────────

export type SecMateria = {
  id: number
  nombre: string
  grado: SecundariaGrado
  orden: number
  seccion: SecundariaSeccion
  enPromedio: boolean
  semaforo: boolean
  comprension: boolean
  activa: boolean
}

const COLS_MATERIA =
  'materia_id, materia_nombre, materia_grado, materia_orden, materia_seccion, materia_en_promedio, materia_semaforo, materia_comprension, materia_activa'

function mapMateria(r: Row): SecMateria {
  const orden = Number(r.materia_orden ?? 0)
  return {
    id: Number(r.materia_id),
    nombre: txt(r.materia_nombre),
    grado: Number(r.materia_grado) as SecundariaGrado,
    orden,
    seccion: r.materia_seccion === 'winston' || (r.materia_seccion == null && orden > 10) ? 'winston' : 'set',
    enPromedio: r.materia_en_promedio !== false,
    semaforo: r.materia_semaforo === true,
    comprension: r.materia_comprension === true,
    activa: r.materia_activa !== false,
  }
}

export async function listarMateriasSec(): Promise<SecMateria[]> {
  const { data, error } = await createBoletasDb()
    .from('boleta_materia')
    .select(COLS_MATERIA)
    .eq('materia_nivel', BOLETAS_NIVEL_SEC)
    .order('materia_grado')
    .order('materia_orden')
    .order('materia_id')
  fail(error, 'Materias de secundaria')
  return ((data ?? []) as Row[]).map(mapMateria).filter((m) => esGradoSecundaria(m.grado))
}

export async function materiasActivasSec(grado?: number): Promise<SecMateria[]> {
  return (await listarMateriasSec()).filter((m) => m.activa && (grado == null || m.grado === grado))
}

export async function materiaSec(id: number): Promise<SecMateria> {
  const m = (await listarMateriasSec()).find((x) => x.id === id)
  if (!m) throw new Error('Esa materia no existe en secundaria.')
  return m
}

async function siguienteId(tabla: 'boleta_materia' | 'boleta_maestro' | 'boleta_maestro_grupo', col: string): Promise<number> {
  const { data, error } = await createBoletasDb().from(tabla).select(col).order(col, { ascending: false }).limit(1)
  fail(error, 'Siguiente id')
  return Number((data?.[0] as Row | undefined)?.[col] ?? 0) + 1
}

export async function guardarMateriaSec(input: Row): Promise<SecMateria> {
  const nombre = txt(input.nombre).toUpperCase()
  const grado = Number(input.grado)
  const orden = Number(input.orden)
  const seccion = input.seccion === 'winston' ? 'winston' : input.seccion === 'set' ? 'set' : null
  const idPrevio = Number(input.id)
  const esNueva = !(Number.isInteger(idPrevio) && idPrevio > 0)
  if (!nombre || nombre.length > 120) throw new Error('Escribe el nombre de la materia (máx. 120 letras).')
  if (!esGradoSecundaria(grado)) throw new Error('Elige 7°, 8° o 9°.')
  if (!Number.isInteger(orden) || orden < 1 || orden > 99) throw new Error('El orden va de 1 a 99.')
  if (!seccion) throw new Error('Elige si la materia es SET (oficial SEP) o Winston.')
  if (!esNueva) {
    const previa = (await listarMateriasSec()).find((m) => m.id === idPrevio)
    if (!previa) throw new Error('Esa materia ya no existe; recarga.')
    if (previa.grado !== grado) throw new Error('No se puede cambiar el grado de una materia; crea una nueva.')
  }
  const fila: Row = {
    materia_nombre: nombre,
    materia_grado: grado,
    materia_orden: orden,
    materia_seccion: seccion,
    materia_en_promedio: bool(input.enPromedio, true),
    materia_semaforo: bool(input.semaforo, false),
    materia_comprension: bool(input.comprension, false),
    materia_activa: bool(input.activa, true),
  }
  const db = createBoletasDb()
  let id = idPrevio
  if (esNueva) {
    id = await siguienteId('boleta_materia', 'materia_id')
    const { error } = await db.from('boleta_materia').insert([
      { ...fila, materia_id: id, materia_nivel: BOLETAS_NIVEL_SEC, materia_registro: new Date().toISOString().slice(0, 10) },
    ])
    fail(error, 'Guardar materia')
  } else {
    const { error } = await db.from('boleta_materia').update(fila).eq('materia_id', id).eq('materia_nivel', BOLETAS_NIVEL_SEC)
    fail(error, 'Guardar materia')
  }
  return materiaSec(id)
}

/** Solo se borra si nunca se calificó; si ya tiene calificaciones hay que desactivarla. */
export async function eliminarMateriaSec(idRaw: unknown): Promise<void> {
  const id = Number(idRaw)
  await materiaSec(id)
  const db = createBoletasDb()
  const { data, error } = await db.from('boleta_calificacion').select('calificacion_id').eq('materia_id', id).limit(1)
  fail(error, 'Revisar calificaciones')
  if (data?.length) throw new Error('Esa materia ya tiene calificaciones guardadas. Desactívala en lugar de borrarla.')
  const { error: errA } = await db.from('boleta_maestro_grupo').delete().eq('materia_id', id)
  fail(errA, 'Quitar asignaciones')
  const { error: errM } = await db.from('boleta_materia').delete().eq('materia_id', id).eq('materia_nivel', BOLETAS_NIVEL_SEC)
  fail(errM, 'Borrar materia')
}

// ── Maestros y asignaciones ─────────────────────────────────────────────────

export type SecAsignacion = { materiaId: number; grupo: string }

export type SecMaestro = {
  id: number
  nombre: string
  app: string
  apm: string
  usuario: string
  email: string
  tieneClave: boolean
  asignaciones: SecAsignacion[]
}

const COLS_MAESTRO = 'maestro_id, maestro_nombre, maestro_app, maestro_apm, maestro_usuario, maestro_email, maestro_clave'

export function nombreMaestro(m: Pick<SecMaestro, 'nombre' | 'app' | 'apm'>): string {
  return [m.nombre, m.app, m.apm].filter(Boolean).join(' ')
}

/** Asignaciones (materia + letra) de todos los maestros de secundaria; `grupo_letra` legacy trae varias letras ("ABC"). */
async function asignacionesSec(): Promise<{ maestroId: number; materiaId: number; grupo: string }[]> {
  const materias = new Set((await listarMateriasSec()).map((m) => m.id))
  const { data, error } = await createBoletasDb()
    .from('boleta_maestro_grupo')
    .select('grupo_id, maestro_id, materia_id, grupo_letra')
    .order('grupo_id')
  fail(error, 'Asignaciones')
  const out = new Map<string, { maestroId: number; materiaId: number; grupo: string }>()
  for (const r of (data ?? []) as Row[]) {
    const materiaId = Number(r.materia_id)
    if (!materias.has(materiaId)) continue
    for (const letra of new Set(String(r.grupo_letra ?? '').toUpperCase())) {
      if (!esGrupoSecundaria(letra)) continue
      const a = { maestroId: Number(r.maestro_id), materiaId, grupo: letra }
      out.set(`${a.maestroId}-${a.materiaId}-${a.grupo}`, a)
    }
  }
  return [...out.values()]
}

export async function listarMaestrosSec(): Promise<SecMaestro[]> {
  const [{ data, error }, asig] = await Promise.all([
    createBoletasDb()
      .from('boleta_maestro')
      .select(COLS_MAESTRO)
      .eq('maestro_nivel', BOLETAS_NIVEL_SEC)
      .order('maestro_nombre')
      .order('maestro_app'),
    asignacionesSec(),
  ])
  fail(error, 'Maestros de secundaria')
  return ((data ?? []) as Row[]).map((r) => {
    const id = Number(r.maestro_id)
    return {
      id,
      nombre: txt(r.maestro_nombre),
      app: txt(r.maestro_app),
      apm: txt(r.maestro_apm),
      usuario: txt(r.maestro_usuario),
      email: txt(r.maestro_email).toLowerCase(),
      tieneClave: Boolean(txt(r.maestro_clave)),
      asignaciones: asig.filter((a) => a.maestroId === id).map(({ materiaId, grupo }) => ({ materiaId, grupo })),
    }
  })
}

export async function guardarMaestroSec(input: Row): Promise<{ id: number }> {
  const nombre = txt(input.nombre).toUpperCase()
  const app = txt(input.app).toUpperCase()
  const apm = txt(input.apm).toUpperCase()
  const usuario = txt(input.usuario).toLowerCase()
  const clave = String(input.clave ?? '')
  const email = txt(input.email).toLowerCase()
  const idPrevio = Number(input.id)
  const esNuevo = !(Number.isInteger(idPrevio) && idPrevio > 0)
  if (!nombre || !app) throw new Error('Escribe nombre y apellido paterno.')
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    throw new Error('Usuario: de 3 a 40 letras, números, punto, guion o guion bajo (sin espacios).')
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('El correo no es válido.')
  if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
  if (esNuevo && !clave && !email) throw new Error('Pon una contraseña o su correo institucional (para entrar con Google).')

  const db = createBoletasDb()
  const { data: mismo, error: errU } = await db.from('boleta_maestro').select('maestro_id').ilike('maestro_usuario', usuario).limit(5)
  fail(errU, 'Revisar usuario')
  if (((mismo ?? []) as Row[]).some((r) => Number(r.maestro_id) !== idPrevio)) throw new Error(`El usuario «${usuario}» ya existe.`)

  let id = idPrevio
  if (esNuevo) {
    id = await siguienteId('boleta_maestro', 'maestro_id')
  } else {
    const { data: previo, error } = await db.from('boleta_maestro').select('maestro_nivel').eq('maestro_id', id).limit(1)
    fail(error, 'Maestro')
    if (Number((previo?.[0] as Row | undefined)?.maestro_nivel) !== BOLETAS_NIVEL_SEC) {
      throw new Error('Ese maestro ya no está en el catálogo de secundaria; recarga.')
    }
  }
  const fila: Row = {
    maestro_id: id,
    maestro_nombre: nombre,
    maestro_app: app,
    maestro_apm: apm || null,
    maestro_usuario: usuario,
    maestro_email: email || null,
    maestro_nivel: BOLETAS_NIVEL_SEC,
  }
  if (clave) fila.maestro_clave = md5Hex(clave)
  if (esNuevo) {
    fila.maestro_sexo = 0
    fila.maestro_registro = new Date().toISOString().slice(0, 10)
  }
  const { error } = esNuevo
    ? await db.from('boleta_maestro').insert([fila])
    : await db.from('boleta_maestro').update(fila).eq('maestro_id', id)
  fail(error, 'Guardar maestro')
  return { id }
}

export async function eliminarMaestroSec(idRaw: unknown): Promise<void> {
  const id = Number(idRaw)
  if (!(await listarMaestrosSec()).some((m) => m.id === id)) throw new Error('Solo se pueden borrar maestros de secundaria.')
  const db = createBoletasDb()
  const { error: errA } = await db.from('boleta_maestro_grupo').delete().eq('maestro_id', id)
  fail(errA, 'Quitar asignaciones')
  const { error } = await db.from('boleta_maestro').delete().eq('maestro_id', id).eq('maestro_nivel', BOLETAS_NIVEL_SEC)
  fail(error, 'Borrar maestro')
}

/** Deja exactamente esos maestros en la materia + grupo (quita la letra a los demás). */
export async function asignarClaseSec(input: { materiaId: unknown; grupo: unknown; maestroIds: unknown }): Promise<void> {
  const materiaId = Number(input.materiaId)
  const grupo = String(input.grupo ?? '').toUpperCase()
  await materiaSec(materiaId)
  if (!esGrupoSecundaria(grupo)) throw new Error('Grupo inválido (A, B o C).')
  const ids = [...new Set((Array.isArray(input.maestroIds) ? input.maestroIds : []).map(Number))]
  const validos = new Set((await listarMaestrosSec()).map((m) => m.id))
  if (ids.some((id) => !validos.has(id))) throw new Error('Ese maestro no es de secundaria; recarga.')

  const db = createBoletasDb()
  const { data, error } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id, maestro_id, grupo_letra')
    .eq('materia_id', materiaId)
    .order('grupo_id')
  fail(error, 'Asignaciones')
  const filas = (data ?? []) as Row[]
  const quiere = new Set(ids)
  const tiene = new Set<number>()
  for (const r of filas) {
    const maestroId = Number(r.maestro_id)
    const letras = new Set(String(r.grupo_letra ?? '').toUpperCase())
    if (letras.has(grupo)) tiene.add(maestroId)
    if (quiere.has(maestroId) || !letras.has(grupo)) continue
    letras.delete(grupo)
    const resto = [...letras].sort().join('')
    const { error: e } = resto
      ? await db.from('boleta_maestro_grupo').update({ grupo_letra: resto }).eq('grupo_id', Number(r.grupo_id))
      : await db.from('boleta_maestro_grupo').delete().eq('grupo_id', Number(r.grupo_id))
    fail(e, 'Quitar asignación')
  }
  for (const maestroId of quiere) {
    if (tiene.has(maestroId)) continue
    const propia = filas.find((r) => Number(r.maestro_id) === maestroId)
    if (propia) {
      const letras = [...new Set(String(propia.grupo_letra ?? '').toUpperCase() + grupo)].sort().join('')
      const { error: e } = await db.from('boleta_maestro_grupo').update({ grupo_letra: letras }).eq('grupo_id', Number(propia.grupo_id))
      fail(e, 'Asignar')
    } else {
      const { error: e } = await db.from('boleta_maestro_grupo').insert([
        {
          grupo_id: await siguienteId('boleta_maestro_grupo', 'grupo_id'),
          maestro_id: maestroId,
          materia_id: materiaId,
          grupo_letra: grupo,
          grupo_registro: new Date().toISOString().slice(0, 10),
        },
      ])
      fail(e, 'Asignar')
    }
  }
}

// ── Alumnos ────────────────────────────────────────────────────────────────

const STATUS_ACTIVOS = [1, 4, 5] as const

export type SecAlumno = { alumno_id: number; alumno_ref: number | null; nombre: string; grado: number; grupo: string }

function mapAlumno(r: Row): SecAlumno {
  return {
    alumno_id: Number(r.alumno_id),
    alumno_ref: r.alumno_ref != null ? Number(r.alumno_ref) : null,
    nombre: [r.alumno_app, r.alumno_apm, r.alumno_nombre].map(txt).filter(Boolean).join(' '),
    grado: Number(r.alumno_grado),
    grupo: letraGrupoSec(Number(r.alumno_grupo)),
  }
}

const COLS_ALUMNO = 'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo'

async function alumnosSec(ciclo: number, grado?: number, grupo?: string): Promise<SecAlumno[]> {
  let q = createBoletasDb()
    .from('alumno')
    .select(COLS_ALUMNO)
    .eq('alumno_nivel', BOLETAS_NIVEL_SEC)
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
  if (grado) q = q.eq('alumno_grado', grado)
  if (grupo) q = q.eq('alumno_grupo', grupoNumeroSec(grupo))
  const { data, error } = await q.order('alumno_app').order('alumno_apm').order('alumno_nombre').limit(PAGINA)
  fail(error, 'Alumnos de secundaria')
  return ((data ?? []) as Row[]).map(mapAlumno).filter((a) => esGradoSecundaria(a.grado) && esGrupoSecundaria(a.grupo))
}

export function alumnosGrupoSec(ciclo: number, grado: number, grupo: string): Promise<SecAlumno[]> {
  return alumnosSec(ciclo, grado, grupo)
}

/** Alumnos del nivel sin grupo (A–C) en el ciclo: no aparecen en ninguna hoja. */
export async function alumnosSinGrupoSec(ciclo: number): Promise<SecAlumno[]> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select(COLS_ALUMNO)
    .eq('alumno_nivel', BOLETAS_NIVEL_SEC)
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .not('alumno_grupo', 'in', '(1,2,3)')
    .order('alumno_app')
  fail(error, 'Alumnos sin grupo')
  return ((data ?? []) as Row[]).map(mapAlumno)
}

export type SecGrupo = { grado: SecundariaGrado; grupo: string; etiqueta: string; alumnos: number }

export async function gruposConAlumnosSec(ciclo: number): Promise<SecGrupo[]> {
  const cuenta = new Map<string, SecGrupo>()
  for (const a of await alumnosSec(ciclo)) {
    const k = `${a.grado}-${a.grupo}`
    const g = cuenta.get(k) ?? { grado: a.grado as SecundariaGrado, grupo: a.grupo, etiqueta: etiquetaGrupoSec(a.grado, a.grupo), alumnos: 0 }
    g.alumnos++
    cuenta.set(k, g)
  }
  return [...cuenta.values()].sort((a, b) => a.grado - b.grado || a.grupo.localeCompare(b.grupo))
}

// ── Clases (materia + grado + grupo) ─────────────────────────────────────────

export type SecClase = {
  materiaId: number
  materia: string
  grado: SecundariaGrado
  grupo: string
  etiqueta: string
  seccion: SecundariaSeccion
  comprension: boolean
  maestros: string[]
}

function ordenClases(a: SecClase, b: SecClase, porMateria: boolean): number {
  return porMateria
    ? a.materia.localeCompare(b.materia, 'es') || a.grado - b.grado || a.grupo.localeCompare(b.grupo)
    : a.grado - b.grado || a.grupo.localeCompare(b.grupo) || a.materia.localeCompare(b.materia, 'es')
}

async function nombresPorClase(): Promise<Map<string, string[]>> {
  const maestros = await listarMaestrosSec()
  const out = new Map<string, string[]>()
  for (const m of maestros) {
    for (const a of m.asignaciones) {
      const k = `${a.materiaId}-${a.grupo}`
      out.set(k, [...(out.get(k) ?? []), nombreMaestro(m)])
    }
  }
  return out
}

function armarClase(m: SecMateria, grupo: string, maestros: string[]): SecClase {
  return {
    materiaId: m.id,
    materia: m.nombre,
    grado: m.grado,
    grupo,
    etiqueta: etiquetaGrupoSec(m.grado, grupo),
    seccion: m.seccion,
    comprension: m.comprension,
    maestros,
  }
}

/** Clases asignadas al maestro (solo materias activas). */
export async function clasesDeMaestroSec(maestroId: number): Promise<SecClase[]> {
  const [materias, asig, nombres] = await Promise.all([materiasActivasSec(), asignacionesSec(), nombresPorClase()])
  const porId = new Map(materias.map((m) => [m.id, m]))
  return asig
    .filter((a) => a.maestroId === maestroId && porId.has(a.materiaId))
    .map((a) => armarClase(porId.get(a.materiaId)!, a.grupo, nombres.get(`${a.materiaId}-${a.grupo}`) ?? []))
    .sort((a, b) => ordenClases(a, b, true))
}

/** Supervisión: todas las materias activas de cada grupo con alumnos en el ciclo. */
export async function clasesSupervisionSec(ciclo: number): Promise<SecClase[]> {
  const [grupos, materias, nombres] = await Promise.all([gruposConAlumnosSec(ciclo), materiasActivasSec(), nombresPorClase()])
  const out: SecClase[] = []
  for (const g of grupos) {
    for (const m of materias.filter((x) => x.grado === g.grado)) {
      out.push(armarClase(m, g.grupo, nombres.get(`${m.id}-${g.grupo}`) ?? []))
    }
  }
  return out.sort((a, b) => ordenClases(a, b, false))
}

export async function maestroTieneClaseSec(maestroId: number, materiaId: number, grupo: string): Promise<boolean> {
  return (await asignacionesSec()).some((a) => a.maestroId === maestroId && a.materiaId === materiaId && a.grupo === grupo)
}

// ── Hoja de captura ─────────────────────────────────────────────────────────

export type SecFilaHoja = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  /** Calificaciones de los trimestres 1–3 ('', '-', '5'…'10'). */
  cal: [string, string, string]
  /** Faltas y conducta (código 1–6) del trimestre pedido. */
  faltas: string
  conducta: string
}

export type SecHoja = {
  materia: SecMateria
  grado: number
  grupo: string
  trimestre: number
  ciclo: number
  filas: SecFilaHoja[]
}

export function filaCompleta(f: SecFilaHoja, trimestre: number): boolean {
  return f.cal[trimestre - 1] !== '' && f.conducta !== ''
}

export async function hojaSec(input: { ciclo: number; materiaId: number; grado: number; grupo: string; trimestre: number }): Promise<SecHoja> {
  const materia = await materiaSec(input.materiaId)
  if (materia.grado !== input.grado) throw new Error('Esa materia no es de ese grado.')
  const alumnos = await alumnosGrupoSec(input.ciclo, input.grado, input.grupo)
  const ids = alumnos.map((a) => a.alumno_id)
  const db = createBoletasDb()
  const [cals, faltas, conds] = await Promise.all([
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_calificacion')
          .select('calificacion_id, alumno_id, calificacion_bimestre, calificacion_puntos')
          .eq('materia_id', materia.id)
          .eq('calificacion_ciclo_escolar', input.ciclo)
          .in('alumno_id', t)
          .order('calificacion_id')
          .range(d, h),
      'Calificaciones'
    ),
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_inasistencia')
          .select('inasistencia_id, alumno_id, inasistencia_cantidad')
          .eq('materia_id', materia.id)
          .eq('inasistencia_ciclo_escolar', input.ciclo)
          .eq('inasistencia_bimestre', input.trimestre)
          .in('alumno_id', t)
          .order('inasistencia_id')
          .range(d, h),
      'Faltas'
    ),
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_conducta')
          .select('conducta_id, alumno_id, conducta_valor')
          .eq('materia_id', materia.id)
          .eq('conducta_ciclo_escolar', input.ciclo)
          .eq('conducta_bimestre', input.trimestre)
          .in('alumno_id', t)
          .order('conducta_id')
          .range(d, h),
      'Conducta'
    ),
  ])
  const cal = new Map<number, [string, string, string]>()
  for (const r of cals) {
    const t = Number(r.calificacion_bimestre)
    if (t < 1 || t > 3) continue
    const id = Number(r.alumno_id)
    const v = cal.get(id) ?? ['', '', '']
    v[t - 1] = califDesdeBd(r.calificacion_puntos)
    cal.set(id, v)
  }
  const fal = new Map(faltas.map((r) => [Number(r.alumno_id), r.inasistencia_cantidad == null ? '' : String(r.inasistencia_cantidad)]))
  const con = new Map(conds.map((r) => [Number(r.alumno_id), normalizarConducta(r.conducta_valor) ?? '']))
  return {
    materia,
    grado: input.grado,
    grupo: input.grupo,
    trimestre: input.trimestre,
    ciclo: input.ciclo,
    filas: alumnos.map((a) => ({
      alumno_id: a.alumno_id,
      alumno_ref: a.alumno_ref,
      nombre: a.nombre,
      cal: cal.get(a.alumno_id) ?? ['', '', ''],
      faltas: fal.get(a.alumno_id) ?? '',
      conducta: con.get(a.alumno_id) ?? '',
    })),
  }
}

export type SecCambioHoja = { alumnoId: number; cal?: unknown; faltas?: unknown; conducta?: unknown }

/** Guarda solo los campos que vienen en cada cambio. '' borra el dato. Valida todo antes de escribir. */
export async function guardarHojaSec(input: {
  ciclo: number
  materiaId: number
  trimestre: number
  alumnos: SecAlumno[]
  cambios: SecCambioHoja[]
}): Promise<{ guardados: number }> {
  const nombres = new Map(input.alumnos.map((a) => [a.alumno_id, a.nombre]))
  const cal: { id: number; v: string }[] = []
  const fal: { id: number; v: string }[] = []
  const con: { id: number; v: string }[] = []
  for (const c of input.cambios) {
    const id = Number(c.alumnoId)
    const nombre = nombres.get(id)
    if (!nombre) throw new Error('Hay un alumno que no es de este grupo; recarga la hoja.')
    if (c.cal !== undefined) {
      const v = normalizarCalifSec(c.cal)
      if (v == null) throw new Error(`${nombre}: la calificación va de 5 a 10 (entero) o «-».`)
      cal.push({ id, v })
    }
    if (c.faltas !== undefined) {
      const v = normalizarFaltas(c.faltas)
      if (v == null) throw new Error(`${nombre}: las faltas van de 0 a 99.`)
      fal.push({ id, v })
    }
    if (c.conducta !== undefined) {
      const v = normalizarConducta(c.conducta)
      if (v == null) throw new Error(`${nombre}: la conducta es E, MB, B, R, S o I.`)
      con.push({ id, v })
    }
  }

  const db = createBoletasDb()
  const ahora = new Date().toISOString()
  const { materiaId, trimestre, ciclo } = input

  const escribir = async (
    lista: { id: number; v: string }[],
    tabla: string,
    cols: { bim: string; ciclo: string; valor: string; registro: string },
    valor: (v: string) => unknown
  ) => {
    const poner = lista.filter((x) => x.v !== '')
    const quitar = lista.filter((x) => x.v === '').map((x) => x.id)
    if (poner.length) {
      const { error } = await db.from(tabla).upsert(
        poner.map((x) => ({
          alumno_id: x.id,
          materia_id: materiaId,
          [cols.bim]: trimestre,
          [cols.ciclo]: ciclo,
          [cols.valor]: valor(x.v),
          [cols.registro]: ahora,
        })),
        { onConflict: `alumno_id,materia_id,${cols.bim},${cols.ciclo}` }
      )
      fail(error, 'Guardar')
    }
    if (quitar.length) {
      const { error } = await db
        .from(tabla)
        .delete()
        .eq('materia_id', materiaId)
        .eq(cols.bim, trimestre)
        .eq(cols.ciclo, ciclo)
        .in('alumno_id', quitar)
      fail(error, 'Borrar')
    }
  }

  await escribir(
    cal,
    'boleta_calificacion',
    { bim: 'calificacion_bimestre', ciclo: 'calificacion_ciclo_escolar', valor: 'calificacion_puntos', registro: 'calificacion_registro' },
    califABd
  )
  await escribir(
    fal,
    'boleta_inasistencia',
    { bim: 'inasistencia_bimestre', ciclo: 'inasistencia_ciclo_escolar', valor: 'inasistencia_cantidad', registro: 'inasistencia_registro' },
    Number
  )
  await escribir(
    con,
    'boleta_conducta',
    { bim: 'conducta_bimestre', ciclo: 'conducta_ciclo_escolar', valor: 'conducta_valor', registro: 'conducta_registro' },
    (v) => v
  )
  return { guardados: cal.length + fal.length + con.length }
}

// ── Comprensión lectora ─────────────────────────────────────────────────────

export type SecFilaComprension = { alumno_id: number; nombre: string; p1: string; p2: string; p3: string }

export async function comprensionSec(input: { ciclo: number; grado: number; grupo: string; mes: number }): Promise<SecFilaComprension[]> {
  if (!esMesComprension(input.mes)) throw new Error('Mes inválido.')
  const alumnos = await alumnosGrupoSec(input.ciclo, input.grado, input.grupo)
  const filas = await filasPorIds(
    alumnos.map((a) => a.alumno_id),
    (t, d, h) =>
      createBoletasDb()
        .from('boleta_comprension_secundaria')
        .select('alumno_id, p1, p2, p3')
        .eq('ciclo', input.ciclo)
        .eq('mes', input.mes)
        .in('alumno_id', t)
        .order('alumno_id')
        .range(d, h),
    'Comprensión lectora'
  )
  const por = new Map(filas.map((r) => [Number(r.alumno_id), r]))
  const v = (x: unknown) => (x == null ? '' : String(x))
  return alumnos.map((a) => {
    const r = por.get(a.alumno_id)
    return { alumno_id: a.alumno_id, nombre: a.nombre, p1: v(r?.p1), p2: v(r?.p2), p3: v(r?.p3) }
  })
}

export async function guardarComprensionSec(input: {
  ciclo: number
  mes: number
  alumnos: SecAlumno[]
  cambios: { alumnoId: number; p1?: unknown; p2?: unknown; p3?: unknown }[]
}): Promise<{ guardados: number }> {
  if (!esMesComprension(input.mes)) throw new Error('Mes inválido.')
  const actuales = new Map(
    (await comprensionSec({ ciclo: input.ciclo, grado: input.alumnos[0]?.grado ?? 0, grupo: input.alumnos[0]?.grupo ?? '', mes: input.mes })).map(
      (f) => [f.alumno_id, f]
    )
  )
  const poner: Row[] = []
  const quitar: number[] = []
  for (const c of input.cambios) {
    const id = Number(c.alumnoId)
    const actual = actuales.get(id)
    if (!actual) throw new Error('Hay un alumno que no es de este grupo; recarga la hoja.')
    const nuevo = { ...actual }
    for (const p of ['p1', 'p2', 'p3'] as const) {
      if (c[p] === undefined) continue
      const v = normalizarComprension(c[p])
      if (v == null) throw new Error(`${actual.nombre}: usa S, CS, EO o RA (o 1 a 4).`)
      nuevo[p] = v
    }
    if (!nuevo.p1 && !nuevo.p2 && !nuevo.p3) quitar.push(id)
    else {
      poner.push({
        alumno_id: id,
        ciclo: input.ciclo,
        mes: input.mes,
        p1: nuevo.p1 ? Number(nuevo.p1) : null,
        p2: nuevo.p2 ? Number(nuevo.p2) : null,
        p3: nuevo.p3 ? Number(nuevo.p3) : null,
        updated_at: new Date().toISOString(),
      })
    }
  }
  const db = createBoletasDb()
  if (poner.length) {
    const { error } = await db.from('boleta_comprension_secundaria').upsert(poner, { onConflict: 'alumno_id,ciclo,mes' })
    fail(error, 'Guardar comprensión lectora')
  }
  if (quitar.length) {
    const { error } = await db
      .from('boleta_comprension_secundaria')
      .delete()
      .eq('ciclo', input.ciclo)
      .eq('mes', input.mes)
      .in('alumno_id', quitar)
    fail(error, 'Borrar comprensión lectora')
  }
  return { guardados: poner.length + quitar.length }
}

// ── Tablero de entregas (dirección) ─────────────────────────────────────────

export type SecTableroMateria = {
  materiaId: number
  materia: string
  seccion: SecundariaSeccion
  maestros: string[]
  completos: number
  total: number
  entrega: BoletaEntrega
}

export type SecTableroGrupo = SecGrupo & {
  materias: SecTableroMateria[]
  enviadas: number
  publicada: boolean
  publicadaEn: string | null
}

export async function tableroSec(ciclo: number, trimestre: number): Promise<SecTableroGrupo[]> {
  const [grupos, materias, nombres, entregas, publicaciones, alumnos] = await Promise.all([
    gruposConAlumnosSec(ciclo),
    materiasActivasSec(),
    nombresPorClase(),
    listarEntregas({ ciclo, modulo: MODULO_SECUNDARIA, trimestre }),
    listarPublicaciones(ciclo, [MODULO_SECUNDARIA]),
    alumnosSec(ciclo),
  ])
  const ids = alumnos.map((a) => a.alumno_id)
  const grupoDe = new Map(alumnos.map((a) => [a.alumno_id, a.grupo]))
  const db = createBoletasDb()
  const [cals, conds] = await Promise.all([
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_calificacion')
          .select('calificacion_id, alumno_id, materia_id')
          .eq('calificacion_ciclo_escolar', ciclo)
          .eq('calificacion_bimestre', trimestre)
          .in('alumno_id', t)
          .order('calificacion_id')
          .range(d, h),
      'Avance'
    ),
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_conducta')
          .select('conducta_id, alumno_id, materia_id')
          .eq('conducta_ciclo_escolar', ciclo)
          .eq('conducta_bimestre', trimestre)
          .in('alumno_id', t)
          .order('conducta_id')
          .range(d, h),
      'Avance'
    ),
  ])
  const conConducta = new Set(conds.map((r) => `${r.alumno_id}-${r.materia_id}`))
  const completos = new Map<string, number>()
  for (const r of cals) {
    if (!conConducta.has(`${r.alumno_id}-${r.materia_id}`)) continue
    const k = `${r.materia_id}-${grupoDe.get(Number(r.alumno_id))}`
    completos.set(k, (completos.get(k) ?? 0) + 1)
  }
  const entregaDe = new Map(entregas.map((e) => [`${e.materiaId}-${e.grado}-${e.grupo}`, e]))
  return grupos.map((g) => {
    const lista = materias
      .filter((m) => m.grado === g.grado)
      .map((m) => ({
        materiaId: m.id,
        materia: m.nombre,
        seccion: m.seccion,
        maestros: nombres.get(`${m.id}-${g.grupo}`) ?? [],
        completos: completos.get(`${m.id}-${g.grupo}`) ?? 0,
        total: g.alumnos,
        entrega:
          entregaDe.get(`${m.id}-${g.grado}-${g.grupo}`) ??
          entregaVacia({ ciclo, modulo: MODULO_SECUNDARIA, trimestre, grado: g.grado, grupo: g.grupo, materiaId: m.id }),
      }))
    const pub = publicaciones.find((p) => p.trimestre === trimestre && publicacionAplica(p, { grado: g.grado, grupo: g.grupo }))
    return {
      ...g,
      materias: lista,
      enviadas: lista.filter((m) => m.entrega.estado === 'enviada').length,
      publicada: Boolean(pub),
      publicadaEn: pub?.publicadaEn ?? null,
    }
  })
}

// ── Promedios y medallas ────────────────────────────────────────────────────

export type SecPeriodo = 1 | 2 | 3 | 'final'

export type SecPromedioAlumno = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grado: number
  grupo: string
  /** Promedios sin truncar (null = sin ninguna calificación en el periodo). */
  winston: number | null
  set: number | null
  /** Materias que cuentan y no tienen calificación en el periodo (cuentan como 0). */
  faltan: string[]
  lugarGrado: number | null
  lugarGrupo: number | null
}

export type SecPromedioGrupo = {
  grado: number
  grupo: string
  etiqueta: string
  alumnos: number
  winston: number | null
  set: number | null
}

export type SecDivisores = Record<number, { winston: number; set: number }>

/**
 * Legacy (BoletaPdfGenerator): materia sin calificación o «-» cuenta 0 y se divide entre el total fijo de materias.
 * Trimestre: Σ calificaciones ÷ N. Final: Σ (promedio de cada materia en sus trimestres capturados) ÷ N.
 */
export function promediosDeAlumno(
  materias: SecMateria[],
  cal: Map<number, [string, string, string]>,
  periodo: SecPeriodo
): { winston: number | null; set: number | null; faltan: string[] } {
  const cuentan = materias.filter((m) => m.enPromedio)
  const valor = (m: SecMateria): number | null => {
    const c = cal.get(m.id) ?? ['', '', '']
    if (periodo === 'final') return promedioMateria(c)
    const v = c[periodo - 1]
    return v === '' ? null : v === SIN_CALIFICACION ? 0 : Number(v)
  }
  let sumaW = 0
  let sumaS = 0
  let alguna = false
  const faltan: string[] = []
  for (const m of cuentan) {
    const v = valor(m)
    if (v == null) {
      faltan.push(m.nombre)
      continue
    }
    alguna = true
    sumaW += v
    if (m.seccion === 'set') sumaS += v
  }
  const nW = cuentan.length
  const nS = cuentan.filter((m) => m.seccion === 'set').length
  return {
    winston: alguna && nW ? sumaW / nW : null,
    set: alguna && nS ? sumaS / nS : null,
    faltan,
  }
}

/** Lugar con empates (1, 1, 3) comparando a 3 decimales truncados, que es lo que se ve. */
function asignarLugares<T>(lista: T[], valor: (x: T) => number | null, poner: (x: T, lugar: number | null) => void): void {
  const conValor = lista.filter((x) => valor(x) != null).sort((a, b) => valor(b)! - valor(a)!)
  let lugar = 0
  let previo: number | null = null
  conValor.forEach((x, i) => {
    const v = truncar(valor(x)!, 3)
    if (v !== previo) {
      lugar = i + 1
      previo = v
    }
    poner(x, lugar)
  })
  lista.filter((x) => valor(x) == null).forEach((x) => poner(x, null))
}

export async function promediosSec(input: { ciclo: number; periodo: SecPeriodo; grado?: number }): Promise<{
  alumnos: SecPromedioAlumno[]
  grupos: SecPromedioGrupo[]
  divisores: SecDivisores
}> {
  const [alumnos, materias] = await Promise.all([alumnosSec(input.ciclo, input.grado), materiasActivasSec(input.grado)])
  const db = createBoletasDb()
  const cals = await filasPorIds(
    alumnos.map((a) => a.alumno_id),
    (t, d, h) =>
      db
        .from('boleta_calificacion')
        .select('calificacion_id, alumno_id, materia_id, calificacion_bimestre, calificacion_puntos')
        .eq('calificacion_ciclo_escolar', input.ciclo)
        .in('calificacion_bimestre', [1, 2, 3])
        .in('alumno_id', t)
        .order('calificacion_id')
        .range(d, h),
    'Calificaciones'
  )
  const porAlumno = new Map<number, Map<number, [string, string, string]>>()
  for (const r of cals) {
    const id = Number(r.alumno_id)
    const mid = Number(r.materia_id)
    const t = Number(r.calificacion_bimestre)
    const m = porAlumno.get(id) ?? new Map<number, [string, string, string]>()
    const v = m.get(mid) ?? ['', '', '']
    v[t - 1] = califDesdeBd(r.calificacion_puntos)
    m.set(mid, v)
    porAlumno.set(id, m)
  }

  const divisores: SecDivisores = {}
  for (const g of [1, 2, 3]) {
    const cuentan = materias.filter((m) => m.grado === g && m.enPromedio)
    divisores[g] = { winston: cuentan.length, set: cuentan.filter((m) => m.seccion === 'set').length }
  }

  const filas: SecPromedioAlumno[] = alumnos.map((a) => ({
    alumno_id: a.alumno_id,
    alumno_ref: a.alumno_ref,
    nombre: a.nombre,
    grado: a.grado,
    grupo: a.grupo,
    ...promediosDeAlumno(
      materias.filter((m) => m.grado === a.grado),
      porAlumno.get(a.alumno_id) ?? new Map(),
      input.periodo
    ),
    lugarGrado: null,
    lugarGrupo: null,
  }))

  const grupos: SecPromedioGrupo[] = []
  for (const g of [1, 2, 3]) {
    const delGrado = filas.filter((f) => f.grado === g)
    asignarLugares(delGrado, (f) => f.winston, (f, l) => (f.lugarGrado = l))
    for (const letra of SECUNDARIA_GRUPOS) {
      const delGrupo = delGrado.filter((f) => f.grupo === letra)
      if (!delGrupo.length) continue
      asignarLugares(delGrupo, (f) => f.winston, (f, l) => (f.lugarGrupo = l))
      const media = (k: 'winston' | 'set') => {
        const vals = delGrupo.map((f) => f[k]).filter((v): v is number => v != null)
        return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null
      }
      grupos.push({
        grado: g,
        grupo: letra,
        etiqueta: etiquetaGrupoSec(g, letra),
        alumnos: delGrupo.length,
        winston: media('winston'),
        set: media('set'),
      })
    }
  }
  filas.sort((a, b) => a.grado - b.grado || (a.lugarGrado ?? 9999) - (b.lugarGrado ?? 9999) || a.nombre.localeCompare(b.nombre, 'es'))
  return { alumnos: filas, grupos, divisores }
}
