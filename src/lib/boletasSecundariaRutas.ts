import { NextResponse } from 'next/server'
import { BoletasAuthError, requireAdmin, requireBoletasSession } from './boletasAuth'
import { jsonError, jsonOk } from './boletasApi'
import { capturaConfigDeSlug, requireSesionCaptura, supervisaModulo, type BoletasCapturaSesion } from './boletasCapturaAuth'
import { fijarCapturaPeriodo, obtenerCapturaPeriodo } from './boletasCapturaPeriodo'
import { etiquetaCicloBoletas } from './boletasCiclo'
import { devolverEntrega, enviarEntrega, obtenerEntrega, type BoletaEntrega } from './boletasEntrega'
import { estaPublicada, publicarTrimestre, retirarTrimestre, trimestreValido } from './boletasPortal'
import {
  MODULO_SECUNDARIA,
  alumnosGrupoSec,
  alumnosSinGrupoSec,
  asignarClaseSec,
  clasesDeMaestroSec,
  clasesSupervisionSec,
  comprensionSec,
  eliminarMaestroSec,
  eliminarMateriaSec,
  esGradoSecundaria,
  esGrupoSecundaria,
  esMesComprension,
  filaCompleta,
  guardarComprensionSec,
  guardarHojaSec,
  guardarMaestroSec,
  guardarMateriaSec,
  hojaSec,
  listarMaestrosSec,
  listarMateriasSec,
  materiaSec,
  maestroTieneClaseSec,
  promediosSec,
  tableroSec,
  type SecClase,
  type SecMateria,
  type SecPeriodo,
} from './boletasSecundariaService'
import { celdasClassroomSec, marcarAjustesClassroomSec, resumenClassroomSec, sincronizarClassroomSec } from './boletasSecundariaClassroom'
import { ligarAlumnoClassroom, type ClassroomCelda } from './boletasPrimariaEnClassroom'
import { fijarTrimestreFechas, obtenerTrimestreFechas } from './boletasTrimestreFechas'
import { resolverCicloEscolarSistemaValor } from './ciclosEscolaresService'

/** Handlers de Boletas Secundaria: portal de maestros (sesión de captura) y dirección (sesión admin de boletas). */

type Params = { params: Promise<{ slug: string }> }
type Row = Record<string, unknown>

function prohibido(msg: string): BoletasAuthError {
  const err = new BoletasAuthError(msg)
  err.status = 403
  return err
}

async function cuerpo(req: Request): Promise<Row> {
  return ((await req.json().catch(() => ({}))) ?? {}) as Row
}

function cambiosDe(raw: unknown): Row[] {
  return Array.isArray(raw) ? (raw.filter((x) => x && typeof x === 'object') as Row[]) : []
}

type Clase = { materia: SecMateria; grupo: string; trimestre: number }

async function claseDe(raw: Row, conTrimestre = true): Promise<Clase> {
  const materia = await materiaSec(Number(raw.materiaId))
  const grupo = String(raw.grupo ?? '').toUpperCase()
  if (!materia.activa) throw new Error('Esa materia está desactivada en el catálogo.')
  if (!esGrupoSecundaria(grupo)) throw new Error('Grupo inválido (A, B o C).')
  const trimestre = conTrimestre ? trimestreValido(raw.trimestre) : 1
  if (trimestre == null) throw new Error('Trimestre inválido (1 a 3).')
  return { materia, grupo, trimestre }
}

type Estado = { entrega: BoletaEntrega; publicada: boolean; editable: boolean }

async function estadoClase(ciclo: number, c: Clase): Promise<Estado> {
  const [entrega, publicada] = await Promise.all([
    obtenerEntrega({ ciclo, modulo: MODULO_SECUNDARIA, trimestre: c.trimestre, grado: c.materia.grado, grupo: c.grupo, materiaId: c.materia.id }),
    estaPublicada(ciclo, MODULO_SECUNDARIA, c.trimestre, { grado: c.materia.grado, grupo: c.grupo }),
  ])
  return { entrega, publicada, editable: entrega.estado !== 'enviada' && !publicada }
}

function assertEditable(e: Estado): void {
  if (e.publicada) throw prohibido('Este trimestre ya está publicado a papás; ya no se puede editar.')
  if (e.entrega.estado === 'enviada') {
    throw prohibido('Ya enviaste esta materia a dirección. Si hay que corregir, tu directora te la regresa.')
  }
}

function respuestaHoja(
  hoja: Awaited<ReturnType<typeof hojaSec>>,
  estado: Estado | null,
  abierto?: number,
  classroom?: Record<number, ClassroomCelda>
) {
  return {
    abierto,
    classroom: classroom ?? {},
    materia: hoja.materia,
    grado: hoja.grado,
    grupo: hoja.grupo,
    trimestre: hoja.trimestre,
    ciclo: { valor: hoja.ciclo, etiqueta: etiquetaCicloBoletas(hoja.ciclo) },
    filas: hoja.filas,
    ...(estado ?? { entrega: null, publicada: false, editable: true }),
  }
}

// ── Portal de maestros (/boletas-captura/secundaria) ────────────────────────

async function sesionPortal(p: Params, req: Request): Promise<BoletasCapturaSesion> {
  const cfg = capturaConfigDeSlug((await p.params).slug)
  if (cfg.slug !== 'secundaria') {
    const err = new BoletasAuthError('Esa boleta no es de este nivel.')
    err.status = 404
    throw err
  }
  const s = requireSesionCaptura(cfg, req)
  if (s.supervisor && !supervisaModulo(s, MODULO_SECUNDARIA)) throw prohibido('Tu cuenta no supervisa secundaria.')
  return s
}

/** Trimestre abierto por la dirección. La supervisión captura en cualquiera. */
async function trimestreAbierto(ciclo: number): Promise<number> {
  return (await obtenerCapturaPeriodo(ciclo, MODULO_SECUNDARIA)).trimestre
}

function assertAbierto(s: BoletasCapturaSesion, abierto: number, trimestre?: number): void {
  if (s.supervisor) return
  if (!abierto) throw prohibido('La captura está cerrada. Tu directora abre el trimestre cuando empieza la captura.')
  if (trimestre != null && trimestre !== abierto) {
    throw prohibido(`Solo está abierto el ${abierto}er trimestre para captura.`)
  }
}

async function assertClaseDelMaestro(s: BoletasCapturaSesion, c: Clase): Promise<void> {
  if (s.supervisor) return
  if (!(await maestroTieneClaseSec(s.maestroId, c.materia.id, c.grupo))) {
    throw prohibido('Esa materia y grupo no están asignados a tu usuario. Pide a tu directora que te los asigne.')
  }
}

/** Avance por clase en el trimestre: completos, total y estado de entrega. */
async function clasesConAvance(clases: SecClase[], ciclo: number, trimestre: number) {
  const tablero = await tableroSec(ciclo, trimestre)
  const por = new Map(
    tablero.flatMap((g) => g.materias.map((m) => [`${m.materiaId}-${g.grupo}`, { ...m, publicada: g.publicada }] as const))
  )
  return clases.map((c) => {
    const t = por.get(`${c.materiaId}-${c.grupo}`)
    return {
      ...c,
      completos: t?.completos ?? 0,
      total: t?.total ?? 0,
      estado: t?.publicada ? 'publicada' : (t?.entrega.estado ?? 'captura'),
    }
  })
}

export function rutasPortalSecundaria() {
  /**
   * Sin materiaId: las clases del maestro (supervisión: todas) con su avance en el trimestre.
   * Con materiaId + grupo + trimestre: la hoja. Con `tipo=comprension` + mes: comprensión lectora.
   */
  const GET = async (req: Request, p: Params) => {
    try {
      const s = await sesionPortal(p, req)
      const url = new URL(req.url)
      const q = (k: string) => url.searchParams.get(k)
      const ciclo = await resolverCicloEscolarSistemaValor()
      const abierto = await trimestreAbierto(ciclo)
      if (!q('materiaId')) {
        const trimestre = trimestreValido(q('trimestre') ?? (abierto || 1)) ?? 1
        const clases = s.supervisor ? await clasesSupervisionSec(ciclo) : await clasesDeMaestroSec(s.maestroId)
        return jsonOk({
          ciclo: { valor: ciclo, etiqueta: etiquetaCicloBoletas(ciclo) },
          trimestre,
          abierto,
          supervisor: Boolean(s.supervisor),
          clases: await clasesConAvance(clases, ciclo, trimestre),
        })
      }
      if (q('tipo') === 'comprension') {
        const c = await claseDe({ materiaId: q('materiaId'), grupo: q('grupo') }, false)
        await assertClaseDelMaestro(s, c)
        if (!c.materia.comprension) throw new Error('Esa materia no lleva comprensión lectora.')
        const mes = Number(q('mes'))
        return jsonOk({
          mes,
          abierto,
          editable: Boolean(s.supervisor || abierto),
          filas: await comprensionSec({ ciclo, grado: c.materia.grado, grupo: c.grupo, mes }),
        })
      }
      const c = await claseDe({ materiaId: q('materiaId'), grupo: q('grupo'), trimestre: q('trimestre') })
      await assertClaseDelMaestro(s, c)
      const [hoja, estado, classroom] = await Promise.all([
        hojaSec({ ciclo, materiaId: c.materia.id, grado: c.materia.grado, grupo: c.grupo, trimestre: c.trimestre }),
        estadoClase(ciclo, c),
        celdasClassroomSec({ ciclo, trimestre: c.trimestre, materiaId: c.materia.id }),
      ])
      const enPeriodo = Boolean(s.supervisor) || c.trimestre === abierto
      return jsonOk(respuestaHoja(hoja, { ...estado, editable: estado.editable && enPeriodo }, abierto, classroom))
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const PUT = async (req: Request, p: Params) => {
    try {
      const s = await sesionPortal(p, req)
      const body = await cuerpo(req)
      const ciclo = await resolverCicloEscolarSistemaValor()
      const abierto = await trimestreAbierto(ciclo)
      if (body.tipo === 'comprension') {
        const c = await claseDe({ materiaId: body.materiaId, grupo: body.grupo }, false)
        await assertClaseDelMaestro(s, c)
        assertAbierto(s, abierto)
        if (!c.materia.comprension) throw new Error('Esa materia no lleva comprensión lectora.')
        const mes = Number(body.mes)
        if (!esMesComprension(mes)) throw new Error('Mes inválido.')
        const alumnos = await alumnosGrupoSec(ciclo, c.materia.grado, c.grupo)
        const r = await guardarComprensionSec({ ciclo, mes, alumnos, cambios: cambiosDe(body.cambios) as { alumnoId: number }[] })
        return jsonOk({ ok: true, ...r })
      }
      const c = await claseDe(body)
      await assertClaseDelMaestro(s, c)
      assertAbierto(s, abierto, c.trimestre)
      assertEditable(await estadoClase(ciclo, c))
      const alumnos = await alumnosGrupoSec(ciclo, c.materia.grado, c.grupo)
      const cambios = cambiosDe(body.cambios) as { alumnoId: number }[]
      const r = await guardarHojaSec({ ciclo, materiaId: c.materia.id, trimestre: c.trimestre, alumnos, cambios })
      await marcarAjustesClassroomSec({ ciclo, trimestre: c.trimestre, materiaId: c.materia.id, cambios })
      return jsonOk({ ok: true, ...r })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  /**
   * Classroom de la materia y grupo: lo trae en vivo mientras el trimestre esté abierto y sin enviar; después
   * solo devuelve la última lectura. `ligar` une a mano un alumno de Classroom con el del grupo.
   */
  const classroom = async (s: BoletasCapturaSesion, body: Row) => {
    const ciclo = await resolverCicloEscolarSistemaValor()
    const abierto = await trimestreAbierto(ciclo)
    const c = await claseDe(body)
    await assertClaseDelMaestro(s, c)
    const estado = await estadoClase(ciclo, c)
    const vivo = estado.editable && (Boolean(s.supervisor) || c.trimestre === abierto)
    const clave = { ciclo, trimestre: c.trimestre, materiaId: c.materia.id, grupo: c.grupo }
    if (body.accion === 'ligar') {
      if (!vivo) throw prohibido('Esta materia ya no está en captura; no se pueden ligar alumnos.')
      const alumnoId = Number(body.alumnoId)
      const alumnos = await alumnosGrupoSec(ciclo, c.materia.grado, c.grupo)
      if (!alumnos.some((a) => a.alumno_id === alumnoId)) throw new Error('Ese alumno no es de este grupo.')
      await ligarAlumnoClassroom(String(body.googleId ?? ''), alumnoId, s.nombre)
    }
    const resumen = vivo
      ? await sincronizarClassroomSec({ ...clave, materia: c.materia, forzar: body.forzar === true || body.accion === 'ligar' })
      : await resumenClassroomSec(clave)
    return jsonOk({ classroom: resumen, congelado: !vivo })
  }

  /** Enviar la materia del grupo a dirección. Si faltan datos avisa (409) salvo que venga `forzar`. */
  const POST = async (req: Request, p: Params) => {
    try {
      const s = await sesionPortal(p, req)
      const body = await cuerpo(req)
      if (body.accion === 'classroom' || body.accion === 'ligar') return await classroom(s, body)
      if (body.accion !== 'enviar') return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
      const ciclo = await resolverCicloEscolarSistemaValor()
      const abierto = await trimestreAbierto(ciclo)
      const c = await claseDe(body)
      await assertClaseDelMaestro(s, c)
      assertAbierto(s, abierto, c.trimestre)
      assertEditable(await estadoClase(ciclo, c))
      const hoja = await hojaSec({ ciclo, materiaId: c.materia.id, grado: c.materia.grado, grupo: c.grupo, trimestre: c.trimestre })
      if (!hoja.filas.length) return NextResponse.json({ error: 'Este grupo no tiene alumnos.' }, { status: 400 })
      const faltan = hoja.filas.filter((f) => !filaCompleta(f, c.trimestre)).map((f) => f.nombre)
      if (faltan.length && body.forzar !== true) {
        return NextResponse.json({ error: 'Faltan calificaciones o conducta.', code: 'incompleto', faltan }, { status: 409 })
      }
      await enviarEntrega(
        { ciclo, modulo: MODULO_SECUNDARIA, trimestre: c.trimestre, grado: c.materia.grado, grupo: c.grupo, materiaId: c.materia.id },
        { maestroId: s.maestroId, nombre: s.nombre }
      )
      return jsonOk(respuestaHoja(hoja, await estadoClase(ciclo, c), abierto))
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  return { GET, PUT, POST }
}

// ── Dirección (/boletas-secundaria) ─────────────────────────────────────────

async function admin(req: Request) {
  const session = await requireBoletasSession(req)
  requireAdmin(session)
  return session
}

function cicloDe(raw: unknown): number {
  const ciclo = Number(raw)
  if (!Number.isInteger(ciclo) || ciclo <= 0) throw new Error('ciclo inválido')
  return ciclo
}

function periodoDe(raw: unknown): SecPeriodo {
  if (raw === 'final') return 'final'
  const t = trimestreValido(raw)
  if (t == null) throw new Error('periodo inválido (1, 2, 3 o final)')
  return t as 1 | 2 | 3
}

export function rutasDireccionSecundaria() {
  const clases = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        const ciclo = cicloDe(new URL(req.url).searchParams.get('ciclo'))
        const [lista, sinGrupo] = await Promise.all([clasesSupervisionSec(ciclo), alumnosSinGrupoSec(ciclo)])
        return jsonOk({ clases: lista, sinGrupo })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  /** La dirección corrige aunque el maestro ya haya enviado; no después de publicar. */
  const hoja = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        const url = new URL(req.url)
        const q = (k: string) => url.searchParams.get(k)
        const ciclo = cicloDe(q('ciclo'))
        if (q('tipo') === 'comprension') {
          const c = await claseDe({ materiaId: q('materiaId'), grupo: q('grupo') }, false)
          return jsonOk({ mes: Number(q('mes')), filas: await comprensionSec({ ciclo, grado: c.materia.grado, grupo: c.grupo, mes: Number(q('mes')) }) })
        }
        const c = await claseDe({ materiaId: q('materiaId'), grupo: q('grupo'), trimestre: q('trimestre') })
        const [h, estado, classroom] = await Promise.all([
          hojaSec({ ciclo, materiaId: c.materia.id, grado: c.materia.grado, grupo: c.grupo, trimestre: c.trimestre }),
          estadoClase(ciclo, c),
          celdasClassroomSec({ ciclo, trimestre: c.trimestre, materiaId: c.materia.id }),
        ])
        return jsonOk(respuestaHoja(h, { ...estado, editable: !estado.publicada }, undefined, classroom))
      } catch (e) {
        return jsonError(e, 400)
      }
    },
    PUT: async (req: Request) => {
      try {
        await admin(req)
        const body = await cuerpo(req)
        const ciclo = cicloDe(body.ciclo)
        if (body.tipo === 'comprension') {
          const c = await claseDe({ materiaId: body.materiaId, grupo: body.grupo }, false)
          const alumnos = await alumnosGrupoSec(ciclo, c.materia.grado, c.grupo)
          const r = await guardarComprensionSec({ ciclo, mes: Number(body.mes), alumnos, cambios: cambiosDe(body.cambios) as { alumnoId: number }[] })
          return jsonOk({ ok: true, ...r })
        }
        const c = await claseDe(body)
        if ((await estadoClase(ciclo, c)).publicada) {
          throw prohibido('Ese trimestre ya está publicado a papás. Retíralo primero para corregir.')
        }
        const alumnos = await alumnosGrupoSec(ciclo, c.materia.grado, c.grupo)
        const cambios = cambiosDe(body.cambios) as { alumnoId: number }[]
        const r = await guardarHojaSec({ ciclo, materiaId: c.materia.id, trimestre: c.trimestre, alumnos, cambios })
        await marcarAjustesClassroomSec({ ciclo, trimestre: c.trimestre, materiaId: c.materia.id, cambios })
        return jsonOk({ ok: true, ...r })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  const entregas = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        const url = new URL(req.url)
        const ciclo = cicloDe(url.searchParams.get('ciclo'))
        const trimestre = trimestreValido(url.searchParams.get('trimestre'))
        if (trimestre == null) throw new Error('trimestre inválido (1 a 3)')
        return jsonOk({ grupos: await tableroSec(ciclo, trimestre) })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
    POST: async (req: Request) => {
      try {
        const session = await admin(req)
        const body = await cuerpo(req)
        const ciclo = cicloDe(body.ciclo)
        const trimestre = trimestreValido(body.trimestre)
        const grado = Number(body.grado)
        const grupo = String(body.grupo ?? '').toUpperCase()
        if (trimestre == null) throw new Error('trimestre inválido (1 a 3)')
        if (!esGradoSecundaria(grado) || !esGrupoSecundaria(grupo)) throw new Error('grado o grupo inválido')
        const quien = session.nombre || session.usuario
        if (body.accion === 'devolver') {
          const materia = await materiaSec(Number(body.materiaId))
          if (materia.grado !== grado) throw new Error('Esa materia no es de ese grado.')
          await devolverEntrega(
            { ciclo, modulo: MODULO_SECUNDARIA, trimestre, grado, grupo, materiaId: materia.id },
            { nombre: quien, comentario: String(body.comentario ?? '') }
          )
        } else if (body.accion === 'publicar') {
          await publicarTrimestre({ ciclo, modulo: MODULO_SECUNDARIA, trimestre, grado, grupo, por: quien })
        } else if (body.accion === 'retirar') {
          await retirarTrimestre({ ciclo, modulo: MODULO_SECUNDARIA, trimestre, grado, grupo })
        } else {
          return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
        }
        return jsonOk({ grupos: await tableroSec(ciclo, trimestre) })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  const promedios = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        const url = new URL(req.url)
        const grado = Number(url.searchParams.get('grado') ?? 0)
        return jsonOk(
          await promediosSec({
            ciclo: cicloDe(url.searchParams.get('ciclo')),
            periodo: periodoDe(url.searchParams.get('periodo')),
            grado: esGradoSecundaria(grado) ? grado : undefined,
          })
        )
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  const catalogo = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        return jsonOk({ materias: await listarMateriasSec() })
      } catch (e) {
        return jsonError(e)
      }
    },
    POST: async (req: Request) => {
      try {
        await admin(req)
        const materia = await guardarMateriaSec(await cuerpo(req))
        return jsonOk({ materia, materias: await listarMateriasSec() })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
    DELETE: async (req: Request) => {
      try {
        await admin(req)
        await eliminarMateriaSec(new URL(req.url).searchParams.get('id'))
        return jsonOk({ materias: await listarMateriasSec() })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  const listaMaestros = async () => jsonOk({ maestros: await listarMaestrosSec(), materias: await listarMateriasSec() })

  const maestros = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        return await listaMaestros()
      } catch (e) {
        return jsonError(e)
      }
    },
    POST: async (req: Request) => {
      try {
        await admin(req)
        const body = await cuerpo(req)
        if (body.accion === 'guardar') await guardarMaestroSec(body)
        else if (body.accion === 'asignar') {
          await asignarClaseSec({ materiaId: body.materiaId, grupo: body.grupo, maestroIds: body.maestroIds })
        } else return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
        return await listaMaestros()
      } catch (e) {
        return jsonError(e, 400)
      }
    },
    DELETE: async (req: Request) => {
      try {
        await admin(req)
        await eliminarMaestroSec(new URL(req.url).searchParams.get('id'))
        return await listaMaestros()
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  /** Trimestre abierto a captura de maestros (0 = cerrada) y fechas de cada trimestre (para Classroom). */
  const periodo = {
    GET: async (req: Request) => {
      try {
        await admin(req)
        const ciclo = cicloDe(new URL(req.url).searchParams.get('ciclo'))
        const [actual, fechas] = await Promise.all([
          obtenerCapturaPeriodo(ciclo, MODULO_SECUNDARIA),
          obtenerTrimestreFechas(ciclo, MODULO_SECUNDARIA),
        ])
        return jsonOk({ ...actual, fechas })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
    POST: async (req: Request) => {
      try {
        const session = await admin(req)
        const body = await cuerpo(req)
        const ciclo = cicloDe(body.ciclo)
        const por = session.nombre || session.usuario
        if (body.accion === 'fechas') {
          const fechas = await fijarTrimestreFechas({ ciclo, modulo: MODULO_SECUNDARIA, fechas: body.fechas, por })
          return jsonOk({ ...(await obtenerCapturaPeriodo(ciclo, MODULO_SECUNDARIA)), fechas })
        }
        const actual = await fijarCapturaPeriodo({ ciclo, modulo: MODULO_SECUNDARIA, trimestre: Number(body.trimestre), por })
        return jsonOk({ ...actual, fechas: await obtenerTrimestreFechas(ciclo, MODULO_SECUNDARIA) })
      } catch (e) {
        return jsonError(e, 400)
      }
    },
  }

  return { clases, hoja, entregas, promedios, catalogo, maestros, periodo }
}
