import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from './boletasAuth'
import { jsonError, jsonOk } from './boletasApi'
import { capturaConfigDeSlug } from './boletasCapturaAuth'
import { assertAlumnoDelGrupo, assertEditable, contextoCaptura, type ContextoCaptura } from './boletasCapturaContexto'
import { cicloEscolarActualBoletas } from './boletasCiclo'
import { devolverEntrega, enviarEntrega } from './boletasEntrega'
import { publicarTrimestre, retirarTrimestre, trimestreValido } from './boletasPortal'
import {
  asignarGrupoDocenteKinder,
  eliminarDocenteKinder,
  guardarDocenteKinder,
  listarDocentesKinder,
} from './boletasKinderEnTeachers'
import {
  eliminarMateriaPrimaria,
  esGradoPrimaria,
  grupoNumeroDesdeLetra,
  listarMateriasPrimaria,
  guardarMateriaPrimaria,
  type IdiomaPrimaria,
} from './boletasPrimariaComun'
import {
  MODULO_PRIMARIA,
  alumnosConProgresoPrimaria,
  capturaParaUiPrimaria,
  guardarCapturaPrimaria,
  obtenerCapturaPrimaria,
  tableroPrimaria,
  type PrimariaAsistencia,
} from './boletasPrimariaService'
import { generarPdfPrimariaEs } from './boletasPrimariaEsService'
import { generarPdfPrimariaEn } from './boletasPrimariaEnService'

/** Handlers de Primaria Español / Inglés: dirección (sesión admin de boletas) y portal de docentes. */

type Params = { params: Promise<{ slug: string }> }

function valoresDeBody(raw: unknown): Record<number, string> {
  const out: Record<number, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[Number(k)] = String(v ?? '')
  return out
}

function asistenciaDeBody(raw: unknown): Partial<PrimariaAsistencia> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return { school_days: String(r.school_days ?? ''), days_absent: String(r.days_absent ?? '') }
}

function pdfGenerador(idioma: IdiomaPrimaria) {
  return idioma === 'es' ? generarPdfPrimariaEs : generarPdfPrimariaEn
}

function respuestaPdf(buf: Buffer, nombre: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

async function admin(req: Request) {
  const session = await requireBoletasSession(req)
  requireAdmin(session)
  return session
}

function periodo(cicloRaw: unknown, trimestreRaw: unknown) {
  const ciclo = Number(cicloRaw)
  const trimestre = trimestreValido(trimestreRaw)
  if (!Number.isInteger(ciclo) || ciclo <= 0) throw new Error('ciclo inválido')
  if (trimestre == null) throw new Error('trimestre inválido (1 a 3)')
  return { ciclo, trimestre }
}

export function rutasDireccionPrimaria(idioma: IdiomaPrimaria) {
  const modulo = MODULO_PRIMARIA[idioma]
  const etiquetaArchivo = `boleta_primaria_${idioma}`

  const alumnos = async (req: Request) => {
    try {
      await admin(req)
      const url = new URL(req.url)
      const grado = Number(url.searchParams.get('grado'))
      const grupo = String(url.searchParams.get('grupo') ?? '').toUpperCase()
      const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
      const bimestre = Number(url.searchParams.get('bimestre') ?? 1)
      if (!esGradoPrimaria(grado) || !grupoNumeroDesdeLetra(grupo)) {
        return NextResponse.json({ error: 'grado (1° a 6°) y grupo (A–C) requeridos' }, { status: 400 })
      }
      const lista = await alumnosConProgresoPrimaria(idioma, { grado, grupo, trimestre: bimestre, ciclo })
      return jsonOk({ alumnos: lista, grado, grupo, ciclo })
    } catch (e) {
      return jsonError(e)
    }
  }

  const capturaGet = async (req: Request) => {
    try {
      await admin(req)
      const url = new URL(req.url)
      const alumnoId = Number(url.searchParams.get('alumnoId'))
      const bimestre = Number(url.searchParams.get('bimestre') ?? 1)
      const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
      if (!alumnoId) return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
      return jsonOk(capturaParaUiPrimaria(await obtenerCapturaPrimaria(idioma, { alumnoId, bimestre, ciclo })))
    } catch (e) {
      return jsonError(e)
    }
  }

  const capturaPut = async (req: Request) => {
    try {
      await admin(req)
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const alumnoId = Number(body.alumnoId)
      if (!alumnoId) return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
      const result = await guardarCapturaPrimaria(idioma, {
        alumnoId,
        bimestre: Number(body.bimestre ?? 1),
        ciclo: Number(body.ciclo ?? cicloEscolarActualBoletas()),
        valores: valoresDeBody(body.valores),
        attendance: asistenciaDeBody(body.attendance),
      })
      return jsonOk({ ok: true, ...result })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const pdf = async (req: Request) => {
    try {
      await admin(req)
      const url = new URL(req.url)
      const alumnoId = Number(url.searchParams.get('alumnoId'))
      const bimestre = Number(url.searchParams.get('bimestre') ?? 1)
      const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
      if (!alumnoId) return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
      const buf = await pdfGenerador(idioma)({ alumnoId, bimestre, ciclo })
      return respuestaPdf(buf, `${etiquetaArchivo}_${alumnoId}_t${bimestre}_${ciclo}.pdf`)
    } catch (e) {
      return jsonError(e)
    }
  }

  const catalogoGet = async (req: Request) => {
    try {
      await admin(req)
      return jsonOk({ materias: await listarMateriasPrimaria(idioma) })
    } catch (e) {
      return jsonError(e)
    }
  }

  const catalogoPost = async (req: Request) => {
    try {
      await admin(req)
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const materia = await guardarMateriaPrimaria(idioma, {
        grado: body.grado,
        id: body.id,
        seccion: body.seccion,
        nombre: body.nombre,
        nombreAlt: body.nombreAlt,
        orden: body.orden,
        enPromedio: body.enPromedio,
        semaforo: body.semaforo,
        activo: body.activo,
      })
      return jsonOk({ materia })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const catalogoDelete = async (req: Request) => {
    try {
      await admin(req)
      const url = new URL(req.url)
      await eliminarMateriaPrimaria(idioma, { grado: url.searchParams.get('grado'), id: url.searchParams.get('id') })
      return jsonOk({ ok: true })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const entregasGet = async (req: Request) => {
    try {
      await admin(req)
      const url = new URL(req.url)
      const { ciclo, trimestre } = periodo(url.searchParams.get('ciclo'), url.searchParams.get('trimestre'))
      return jsonOk({ grupos: await tableroPrimaria(idioma, ciclo, trimestre) })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const entregasPost = async (req: Request) => {
    try {
      const session = await admin(req)
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const { ciclo, trimestre } = periodo(body.ciclo, body.trimestre)
      const grado = Number(body.grado)
      const grupo = String(body.grupo ?? '').toUpperCase()
      if (!esGradoPrimaria(grado) || !grupoNumeroDesdeLetra(grupo)) {
        return NextResponse.json({ error: 'grado o grupo inválido' }, { status: 400 })
      }
      const quien = session.nombre || session.usuario
      if (body.accion === 'devolver') {
        await devolverEntrega(
          { ciclo, modulo, trimestre, grado, grupo },
          { nombre: quien, comentario: String(body.comentario ?? '') }
        )
      } else if (body.accion === 'publicar') {
        await publicarTrimestre({ ciclo, modulo, trimestre, grado, grupo, por: quien })
      } else if (body.accion === 'retirar') {
        await retirarTrimestre({ ciclo, modulo, trimestre, grado, grupo })
      } else {
        return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
      }
      return jsonOk({ grupos: await tableroPrimaria(idioma, ciclo, trimestre) })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const listarDocentes = async () => jsonOk({ teachers: await listarDocentesKinder(idioma, 'primaria') })

  const docentesGet = async (req: Request) => {
    try {
      await admin(req)
      return await listarDocentes()
    } catch (e) {
      return jsonError(e)
    }
  }

  const docentesPost = async (req: Request) => {
    try {
      await admin(req)
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      if (body.accion === 'guardar') {
        await guardarDocenteKinder(idioma, body, 'primaria')
      } else if (body.accion === 'asignar') {
        await asignarGrupoDocenteKinder(
          idioma,
          { grado: body.grado, grupo: body.grupo, maestroId: body.maestroId },
          'primaria'
        )
      } else {
        return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
      }
      return await listarDocentes()
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const docentesDelete = async (req: Request) => {
    try {
      await admin(req)
      await eliminarDocenteKinder(idioma, new URL(req.url).searchParams.get('id'), 'primaria')
      return await listarDocentes()
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  return {
    alumnos: { GET: alumnos },
    captura: { GET: capturaGet, PUT: capturaPut },
    pdf: { GET: pdf },
    catalogo: { GET: catalogoGet, POST: catalogoPost, DELETE: catalogoDelete },
    entregas: { GET: entregasGet, POST: entregasPost },
    docentes: { GET: docentesGet, POST: docentesPost, DELETE: docentesDelete },
  }
}

export function rutasPortalPrimaria(idioma: IdiomaPrimaria) {
  const modulo = MODULO_PRIMARIA[idioma]
  type Raw = { grado: unknown; grupo: unknown; trimestre: unknown }
  const contexto = async (p: Params, req: Request, raw: Raw) =>
    contextoCaptura(capturaConfigDeSlug((await p.params).slug), req, raw, modulo)
  const rawDeUrl = (url: URL): Raw => ({
    grado: url.searchParams.get('grado'),
    grupo: url.searchParams.get('grupo'),
    trimestre: url.searchParams.get('trimestre'),
  })
  const estado = (ctx: ContextoCaptura) => ({
    ciclo: ctx.ciclo,
    trimestre: ctx.trimestre,
    grado: ctx.grado,
    grupo: ctx.grupo,
    entrega: ctx.entrega,
    publicada: ctx.publicada,
    editable: ctx.editable,
  })
  const alumnos = (ctx: ContextoCaptura) =>
    alumnosConProgresoPrimaria(idioma, { grado: ctx.grado, grupo: ctx.grupo, trimestre: ctx.trimestre, ciclo: ctx.ciclo })

  /** Sin alumnoId: alumnos del grupo con avance. Con alumnoId: su boleta del trimestre. */
  const GET = async (req: Request, p: Params) => {
    try {
      const url = new URL(req.url)
      const ctx = await contexto(p, req, rawDeUrl(url))
      const alumnoId = Number(url.searchParams.get('alumnoId') ?? 0)
      if (alumnoId) {
        await assertAlumnoDelGrupo(ctx, alumnoId)
        const captura = await obtenerCapturaPrimaria(idioma, { alumnoId, bimestre: ctx.trimestre, ciclo: ctx.ciclo })
        return jsonOk({ ...estado(ctx), captura: capturaParaUiPrimaria(captura) })
      }
      return jsonOk({ ...estado(ctx), alumnos: await alumnos(ctx) })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  const PUT = async (req: Request, p: Params) => {
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const ctx = await contexto(p, req, body as Raw)
      assertEditable(ctx)
      const alumnoId = Number(body.alumnoId)
      await assertAlumnoDelGrupo(ctx, alumnoId)
      const result = await guardarCapturaPrimaria(idioma, {
        alumnoId,
        bimestre: ctx.trimestre,
        ciclo: ctx.ciclo,
        valores: valoresDeBody(body.valores),
        attendance: asistenciaDeBody(body.attendance),
      })
      return jsonOk({ ok: true, ...result })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  /** Enviar el grupo a dirección. Si faltan calificaciones, avisa (409) salvo que venga `forzar`. */
  const POST = async (req: Request, p: Params) => {
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      if (body.accion !== 'enviar') return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
      const ctx = await contexto(p, req, body as Raw)
      assertEditable(ctx)
      const lista = await alumnos(ctx)
      if (!lista.length) return NextResponse.json({ error: 'Este grupo no tiene alumnos.' }, { status: 400 })
      const faltan = lista.filter((a) => !a.progreso || a.progreso.capturadas < a.progreso.total).map((a) => a.nombre)
      if (faltan.length && body.forzar !== true) {
        return NextResponse.json({ error: 'Faltan calificaciones.', code: 'incompleto', faltan }, { status: 409 })
      }
      const entrega = await enviarEntrega(
        { ciclo: ctx.ciclo, modulo, trimestre: ctx.trimestre, grado: ctx.grado, grupo: ctx.grupo },
        { maestroId: ctx.sesion.maestroId, nombre: ctx.sesion.nombre }
      )
      return jsonOk({ ...estado({ ...ctx, entrega, editable: false }), alumnos: lista })
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  /** Vista previa en PDF de la boleta de un alumno del grupo. */
  const PDF = async (req: Request, p: Params) => {
    try {
      const url = new URL(req.url)
      const ctx = await contexto(p, req, rawDeUrl(url))
      const alumnoId = Number(url.searchParams.get('alumnoId'))
      await assertAlumnoDelGrupo(ctx, alumnoId)
      const buf = await pdfGenerador(idioma)({ alumnoId, bimestre: ctx.trimestre, ciclo: ctx.ciclo })
      return respuestaPdf(buf, `boleta_primaria_${idioma}_${alumnoId}_t${ctx.trimestre}.pdf`)
    } catch (e) {
      return jsonError(e, 400)
    }
  }

  return { GET, PUT, POST, PDF }
}
