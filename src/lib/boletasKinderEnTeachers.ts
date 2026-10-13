import { createBoletasDb } from './boletasInsforge'
import { md5Hex } from './boletasAuth'
import {
  asegurarMateriasGradoGrupo,
  asignarMaestroGradoGrupo,
  upsertAsignacionCatalogo,
} from './catalogoMaestrosService'
import { MATERIA_SLOT_EN } from './catalogoMaestrosConstants'
import { esGradoKinderEn, grupoNumeroDesdeLetra } from './boletasKinderEnCatalog'
import { teachersPorGrupoKinderEn } from './boletasCapturaGrupos'

export type TeacherKinderEn = {
  id: number
  nombre: string
  app: string
  apm: string
  nombreCompleto: string
  usuario: string
  email: string
  /** 1 Maternal · 2 Kinder */
  nivel: number
  tieneClave: boolean
  grupos: { grado: number; grupo: string }[]
}

const COLS =
  'maestro_id, maestro_nombre, maestro_app, maestro_apm, maestro_usuario, maestro_clave, maestro_email, maestro_nivel, maestro_idioma'

function txt(v: unknown): string {
  return String(v ?? '').trim()
}

export async function listarTeachersKinderEn(): Promise<TeacherKinderEn[]> {
  const [{ data, error }, porGrupo] = await Promise.all([
    createBoletasDb()
      .from('boleta_maestro')
      .select(COLS)
      .in('maestro_nivel', [1, 2])
      .eq('maestro_idioma', 'en')
      .order('maestro_nombre'),
    teachersPorGrupoKinderEn(),
  ])
  if (error) throw new Error(error.message)
  const grupos = new Map<number, { grado: number; grupo: string }[]>()
  for (const [clave, info] of porGrupo) {
    const [g, letra] = clave.split('-')
    const lista = grupos.get(info.maestroId) ?? []
    lista.push({ grado: Number(g), grupo: letra })
    grupos.set(info.maestroId, lista)
  }
  return ((data ?? []) as Record<string, unknown>[]).map((m) => {
    const id = Number(m.maestro_id)
    const nombre = txt(m.maestro_nombre)
    const app = txt(m.maestro_app)
    const apm = txt(m.maestro_apm)
    return {
      id,
      nombre,
      app,
      apm,
      nombreCompleto: [nombre, app, apm].filter(Boolean).join(' '),
      usuario: txt(m.maestro_usuario),
      email: txt(m.maestro_email),
      nivel: Number(m.maestro_nivel),
      tieneClave: Boolean(txt(m.maestro_clave)),
      grupos: (grupos.get(id) ?? []).sort((a, b) => a.grado - b.grado || a.grupo.localeCompare(b.grupo)),
    }
  })
}

export async function guardarTeacherKinderEn(input: {
  id?: unknown
  nombre?: unknown
  app?: unknown
  apm?: unknown
  usuario?: unknown
  clave?: unknown
  email?: unknown
  nivel?: unknown
}): Promise<{ id: number }> {
  const nombre = txt(input.nombre).toUpperCase()
  const app = txt(input.app).toUpperCase()
  const apm = txt(input.apm).toUpperCase()
  const usuario = txt(input.usuario).toLowerCase()
  const clave = String(input.clave ?? '')
  const email = txt(input.email).toLowerCase()
  const nivel = Number(input.nivel)
  const idPrevio = Number(input.id)
  const esNuevo = !(Number.isInteger(idPrevio) && idPrevio > 0)

  if (!nombre || !app) throw new Error('Escribe nombre y apellido paterno.')
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    throw new Error('Usuario: de 3 a 40 letras, números, punto, guion o guion bajo (sin espacios).')
  }
  if (nivel !== 1 && nivel !== 2) throw new Error('Elige Maternal o Kinder.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('El correo no es válido.')
  if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
  if (esNuevo && !clave && !email) {
    throw new Error('Pon una contraseña o su correo institucional (para entrar con Google).')
  }

  const db = createBoletasDb()
  const { data: mismoUsuario, error: errU } = await db
    .from('boleta_maestro')
    .select('maestro_id')
    .ilike('maestro_usuario', usuario)
    .limit(5)
  if (errU) throw new Error(errU.message)
  if ((mismoUsuario ?? []).some((r) => Number(r.maestro_id) !== idPrevio)) {
    throw new Error(`El usuario «${usuario}» ya existe.`)
  }

  let id = idPrevio
  if (esNuevo) {
    const { data: ult } = await db
      .from('boleta_maestro')
      .select('maestro_id')
      .order('maestro_id', { ascending: false })
      .limit(1)
    id = Number((ult?.[0] as Record<string, unknown> | undefined)?.maestro_id ?? 0) + 1
  } else {
    const { data: previo, error: errP } = await db
      .from('boleta_maestro')
      .select('maestro_nivel, maestro_idioma')
      .eq('maestro_id', id)
      .limit(1)
    if (errP) throw new Error(errP.message)
    const p = previo?.[0] as Record<string, unknown> | undefined
    if (!p || p.maestro_idioma !== 'en') throw new Error('Esa teacher ya no está en el catálogo; recarga.')
    if (Number(p.maestro_nivel) !== nivel) {
      const actuales = (await listarTeachersKinderEn()).find((t) => t.id === id)
      if (actuales?.grupos.length) throw new Error('Para cambiarla de nivel primero quítale sus grupos.')
    }
  }

  const fila: Record<string, unknown> = {
    maestro_id: id,
    maestro_nombre: nombre,
    maestro_app: app,
    maestro_apm: apm || null,
    maestro_usuario: usuario,
    maestro_email: email || null,
    maestro_nivel: nivel,
    maestro_idioma: 'en',
  }
  if (clave) fila.maestro_clave = md5Hex(clave)
  if (esNuevo) fila.maestro_sexo = 0
  const { error } = esNuevo
    ? await db.from('boleta_maestro').insert([fila])
    : await db.from('boleta_maestro').update(fila).eq('maestro_id', id)
  if (error) throw new Error(`Guardar teacher: ${error.message}`)
  return { id }
}

/** Quita sus grupos de inglés y la borra del catálogo. */
export async function eliminarTeacherKinderEn(idRaw: unknown): Promise<void> {
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) throw new Error('Teacher inválida.')
  const db = createBoletasDb()
  const { data: previo } = await db.from('boleta_maestro').select('maestro_idioma').eq('maestro_id', id).limit(1)
  if ((previo?.[0] as Record<string, unknown> | undefined)?.maestro_idioma !== 'en') {
    throw new Error('Solo se pueden borrar teachers de inglés desde aquí.')
  }
  const { data: asig, error: errA } = await db.from('boleta_maestro_grupo').select('grupo_id').eq('maestro_id', id)
  if (errA) throw new Error(errA.message)
  if (asig?.length) {
    const { error } = await db
      .from('boleta_maestro_grupo')
      .delete()
      .in('grupo_id', asig.map((a) => Number(a.grupo_id)))
    if (error) throw new Error(error.message)
  }
  const { error } = await db.from('boleta_maestro').delete().eq('maestro_id', id)
  if (error) throw new Error(`Borrar teacher: ${error.message}`)
}

/** Asigna (o quita con maestroId 0) la teacher de inglés de un grupo. Maternal: grupo A/B = materia_grado 1/2. */
export async function asignarGrupoKinderEn(input: {
  grado: unknown
  grupo: unknown
  maestroId: unknown
}): Promise<void> {
  const grado = Number(input.grado)
  const grupo = txt(input.grupo).toUpperCase()
  const maestroId = Number(input.maestroId) || 0
  if (!esGradoKinderEn(grado)) throw new Error('Grado inválido.')
  if (!grupoNumeroDesdeLetra(grupo)) throw new Error('Grupo inválido.')

  if (maestroId > 0) {
    const { data } = await createBoletasDb()
      .from('boleta_maestro')
      .select('maestro_idioma')
      .eq('maestro_id', maestroId)
      .limit(1)
    if ((data?.[0] as Record<string, unknown> | undefined)?.maestro_idioma !== 'en') {
      throw new Error('Esa persona no está en el catálogo de teachers de inglés.')
    }
  }

  if (grado > 0) {
    await asignarMaestroGradoGrupo({ nivel: 2, grado, grupo_letra: grupo, idioma: 'en', maestro_id: maestroId })
    return
  }

  const gradoMaternal = grupoNumeroDesdeLetra(grupo)
  if (gradoMaternal > 2) throw new Error('Maternal solo tiene grupos A y B.')
  const slots = await asegurarMateriasGradoGrupo(1, gradoMaternal)
  const slot = slots.find((s) => s.materia_orden === MATERIA_SLOT_EN.orden)
  if (!slot) throw new Error('No se pudo resolver la materia de Maternal.')
  const db = createBoletasDb()
  const { error } = await db.from('boleta_maestro_grupo').delete().eq('materia_id', slot.materia_id)
  if (error) throw new Error(error.message)
  if (maestroId > 0) {
    await upsertAsignacionCatalogo({ maestro_id: maestroId, materia_id: slot.materia_id, grupo_letra: 'A' })
  }
}
