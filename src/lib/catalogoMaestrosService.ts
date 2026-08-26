import { createDbAdmin } from './insforgeAdmin'
import {
  MATERIA_SLOT_EN,
  MATERIA_SLOT_ES,
  type CatalogoMaestrosTab,
  nivelesDeTab,
} from './catalogoMaestrosConstants'

function db() {
  return createDbAdmin()
}

function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

async function nextId(tabla: 'boleta_maestro' | 'boleta_materia' | 'boleta_maestro_grupo', col: string) {
  const client = db()
  const { data } = await client
    .from(tabla)
    .select(col)
    .order(col, { ascending: false })
    .limit(1)
  const row = data?.[0] as Record<string, unknown> | undefined
  return n(row?.[col], 0) + 1
}

export type MaestroRow = {
  maestro_id: number
  maestro_app: string | null
  maestro_apm: string | null
  maestro_nombre: string | null
  maestro_usuario: string
  maestro_email: string | null
  maestro_sexo: number
  maestro_celular: string | null
  maestro_nivel: number
}

export type MateriaRow = {
  materia_id: number
  materia_nombre: string
  materia_nivel: number
  materia_grado: number
  materia_orden: number
}

export type AsignacionRow = {
  grupo_id: number
  maestro_id: number
  materia_id: number
  grupo_letra: string
  maestro_nombre?: string
  materia_nombre?: string
  materia_nivel?: number
  materia_grado?: number
}

async function assertMaestroDelNivel(maestroId: number, materiaNivel: number) {
  const { data } = await db()
    .from('boleta_maestro')
    .select('maestro_nivel')
    .eq('maestro_id', maestroId)
    .maybeSingle()
  if (!data) throw new Error('Maestro no encontrado')
  const nv = n(data.maestro_nivel, 4)
  if (nv !== materiaNivel) {
    throw new Error('Este docente pertenece a otro nivel escolar.')
  }
}

export async function listarMaestrosCatalogo(opts: { tab: CatalogoMaestrosTab }): Promise<MaestroRow[]> {
  const niveles = nivelesDeTab(opts.tab)
  const { data, error } = await db()
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_email, maestro_sexo, maestro_celular, maestro_nivel'
    )
    .in('maestro_nivel', niveles)
    .order('maestro_nivel')
    .order('maestro_app')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...(row as MaestroRow),
    maestro_nivel: n((row as MaestroRow).maestro_nivel, 4),
  }))
}

export async function upsertMaestroCatalogo(row: {
  maestro_id?: number
  maestro_app?: string
  maestro_apm?: string
  maestro_nombre?: string
  maestro_usuario: string
  maestro_clave?: string
  maestro_email?: string
  maestro_sexo?: number
  maestro_celular?: string
  maestro_nivel: number
  tab?: CatalogoMaestrosTab
}) {
  const client = db()
  const nivelesPermitidos = row.tab ? nivelesDeTab(row.tab) : [1, 2, 3, 4]
  const maestroNivel = n(row.maestro_nivel, 4)
  if (!nivelesPermitidos.includes(maestroNivel as (typeof nivelesPermitidos)[number])) {
    throw new Error('El nivel del maestro no corresponde a esta pestaña.')
  }

  let id = row.maestro_id
  if (!id) id = await nextId('boleta_maestro', 'maestro_id')

  const payload: Record<string, unknown> = {
    maestro_id: id,
    maestro_app: row.maestro_app?.trim() || null,
    maestro_apm: row.maestro_apm?.trim() || null,
    maestro_nombre: row.maestro_nombre?.trim() || null,
    maestro_usuario: row.maestro_usuario.trim(),
    maestro_email: row.maestro_email?.trim() || null,
    maestro_sexo: n(row.maestro_sexo, 0),
    maestro_celular: row.maestro_celular?.trim() || null,
    maestro_nivel: maestroNivel,
  }
  if (row.maestro_clave != null && String(row.maestro_clave).length > 0) {
    payload.maestro_clave = row.maestro_clave
  }

  const { error } = await client.from('boleta_maestro').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

export async function eliminarMaestroCatalogo(maestroId: number) {
  const { error } = await db().from('boleta_maestro').delete().eq('maestro_id', maestroId)
  if (error) throw new Error(error.message)
}

export async function listarMateriasCatalogo(opts: {
  tab: CatalogoMaestrosTab
  grado?: number
}): Promise<MateriaRow[]> {
  const niveles = nivelesDeTab(opts.tab)
  let q = db()
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_nivel, materia_grado, materia_orden')
    .in('materia_nivel', niveles)
    .order('materia_nivel')
    .order('materia_grado')
    .order('materia_orden')
    .order('materia_nombre')
  if (opts.grado && opts.grado > 0) q = q.eq('materia_grado', opts.grado)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as MateriaRow[]
}

export async function upsertMateriaCatalogo(row: {
  materia_id?: number
  materia_nombre: string
  materia_nivel: number
  materia_grado: number
  materia_orden?: number
}) {
  const client = db()
  let id = row.materia_id
  if (!id) id = await nextId('boleta_materia', 'materia_id')
  const payload = {
    materia_id: id,
    materia_nombre: row.materia_nombre.trim(),
    materia_nivel: n(row.materia_nivel),
    materia_grado: n(row.materia_grado),
    materia_orden: n(row.materia_orden, 0),
  }
  const { error } = await client.from('boleta_materia').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

export async function eliminarMateriaCatalogo(materiaId: number) {
  const { error } = await db().from('boleta_materia').delete().eq('materia_id', materiaId)
  if (error) throw new Error(error.message)
}

/** Asegura las dos materias fijas (Maestro(a) / Teacher) por grado en maternal–primaria. */
export async function asegurarMateriasGradoGrupo(nivel: number, grado: number) {
  const client = db()
  const slots = [
    { ...MATERIA_SLOT_ES, nivel, grado },
    { ...MATERIA_SLOT_EN, nivel, grado },
  ]
  const out: MateriaRow[] = []

  for (const slot of slots) {
    const { data: existente } = await client
      .from('boleta_materia')
      .select('materia_id, materia_nombre, materia_nivel, materia_grado, materia_orden')
      .eq('materia_nivel', nivel)
      .eq('materia_grado', grado)
      .eq('materia_orden', slot.orden)
      .maybeSingle()

    if (existente) {
      out.push(existente as MateriaRow)
      continue
    }

    const creada = await upsertMateriaCatalogo({
      materia_nombre: slot.nombre,
      materia_nivel: nivel,
      materia_grado: grado,
      materia_orden: slot.orden,
    })
    out.push(creada as MateriaRow)
  }

  return out
}

export async function listarAsignacionesCatalogo(opts: {
  tab: CatalogoMaestrosTab
  grado?: number
}): Promise<AsignacionRow[]> {
  const niveles = nivelesDeTab(opts.tab)
  const { data: materias, error: errMat } = await db()
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_nivel, materia_grado')
    .in('materia_nivel', niveles)
  if (errMat) throw new Error(errMat.message)

  let matRows = materias ?? []
  if (opts.grado && opts.grado > 0) {
    matRows = matRows.filter((m) => n(m.materia_grado) === opts.grado)
  }
  const matIds = matRows.map((m) => n(m.materia_id))
  if (!matIds.length) return []

  const { data: asig, error } = await db()
    .from('boleta_maestro_grupo')
    .select('grupo_id, maestro_id, materia_id, grupo_letra')
    .in('materia_id', matIds)
    .order('grupo_id')
  if (error) throw new Error(error.message)

  const maestroIds = [...new Set((asig ?? []).map((a) => n(a.maestro_id)))]
  const matMap = new Map(matRows.map((m) => [n(m.materia_id), m]))
  const maestroMap = new Map<number, string>()

  if (maestroIds.length) {
    const { data: maestros } = await db()
      .from('boleta_maestro')
      .select('maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_nivel')
      .in('maestro_id', maestroIds)
      .in('maestro_nivel', niveles)
    for (const m of maestros ?? []) {
      const nombre = [m.maestro_nombre, m.maestro_app, m.maestro_apm]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ')
      maestroMap.set(n(m.maestro_id), nombre || `#${m.maestro_id}`)
    }
  }

  return (asig ?? []).map((a) => {
    const mat = matMap.get(n(a.materia_id))
    return {
      grupo_id: n(a.grupo_id),
      maestro_id: n(a.maestro_id),
      materia_id: n(a.materia_id),
      grupo_letra: String(a.grupo_letra ?? ''),
      maestro_nombre: maestroMap.get(n(a.maestro_id)),
      materia_nombre: String(mat?.materia_nombre ?? ''),
      materia_nivel: n(mat?.materia_nivel),
      materia_grado: n(mat?.materia_grado),
    }
  })
}

export async function upsertAsignacionCatalogo(row: {
  grupo_id?: number
  maestro_id: number
  materia_id: number
  grupo_letra: string
}) {
  const client = db()
  let id = row.grupo_id
  if (!id) id = await nextId('boleta_maestro_grupo', 'grupo_id')

  const letra = String(row.grupo_letra || 'A').toUpperCase()
  const materiaId = n(row.materia_id)
  const maestroId = n(row.maestro_id)

  const { data: materia } = await client
    .from('boleta_materia')
    .select('materia_nivel')
    .eq('materia_id', materiaId)
    .maybeSingle()
  if (!materia) throw new Error('Materia no encontrada')
  await assertMaestroDelNivel(maestroId, n(materia.materia_nivel, 4))

  const { data: duplicado } = await client
    .from('boleta_maestro_grupo')
    .select('grupo_id')
    .eq('materia_id', materiaId)
    .eq('grupo_letra', letra)
    .neq('grupo_id', id)
    .maybeSingle()

  if (duplicado) {
    throw new Error(`Ya hay un maestro asignado a esta materia y grupo ${letra}.`)
  }

  const payload = {
    grupo_id: id,
    maestro_id: maestroId,
    materia_id: materiaId,
    grupo_letra: letra,
  }
  const { error } = await client.from('boleta_maestro_grupo').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

export async function eliminarAsignacionCatalogo(grupoId: number) {
  const { error } = await db().from('boleta_maestro_grupo').delete().eq('grupo_id', grupoId)
  if (error) throw new Error(error.message)
}

/** Asignación rápida grado+grupo (maternal/primaria): crea materia slot si falta. */
export async function asignarMaestroGradoGrupo(opts: {
  nivel: number
  grado: number
  grupo_letra: string
  idioma: 'es' | 'en'
  maestro_id: number
}) {
  const slots = await asegurarMateriasGradoGrupo(opts.nivel, opts.grado)
  const slot = slots.find((s) =>
    opts.idioma === 'es' ? s.materia_orden === MATERIA_SLOT_ES.orden : s.materia_orden === MATERIA_SLOT_EN.orden
  )
  if (!slot) throw new Error('No se pudo resolver la materia del grado.')

  const existentes = await listarAsignacionesCatalogo({
    tab: opts.nivel <= 2 ? 'maternal-kinder' : opts.nivel === 3 ? 'primaria' : 'secundaria',
    grado: opts.grado,
  })
  const prev = existentes.find(
    (a) => a.materia_id === slot.materia_id && a.grupo_letra.toUpperCase() === opts.grupo_letra.toUpperCase()
  )

  if (opts.maestro_id <= 0) {
    if (prev) await eliminarAsignacionCatalogo(prev.grupo_id)
    return { eliminado: true }
  }

  await assertMaestroDelNivel(opts.maestro_id, opts.nivel)

  return upsertAsignacionCatalogo({
    grupo_id: prev?.grupo_id,
    maestro_id: opts.maestro_id,
    materia_id: slot.materia_id,
    grupo_letra: opts.grupo_letra,
  })
}

export function nombreMaestro(m: Pick<MaestroRow, 'maestro_nombre' | 'maestro_app' | 'maestro_apm'>): string {
  return [m.maestro_nombre, m.maestro_app, m.maestro_apm]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}
