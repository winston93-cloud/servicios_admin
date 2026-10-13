import { NextResponse } from 'next/server'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { capturaConfigDeSlug } from '@/lib/boletasCapturaAuth'
import {
  assertAlumnoDelGrupo,
  assertEditable,
  contextoTeacherKinderEn,
  type ContextoTeacherKinderEn,
} from '@/lib/boletasCapturaKinderEn'
import { enviarEntrega } from '@/lib/boletasEntrega'
import {
  capturaParaUi,
  guardarCaptura,
  listarAlumnos,
  obtenerCaptura,
  progresoAlumnos,
} from '@/lib/boletasKinderEsService'
import type { KinderEsGrado } from '@/lib/boletasKinderEsCatalog'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }
type Raw = { grado: unknown; grupo: unknown; trimestre: unknown }

const contexto = (slug: string, req: Request, raw: Raw) =>
  contextoTeacherKinderEn(capturaConfigDeSlug(slug), req, raw, 'kinder-es')

function estado(ctx: ContextoTeacherKinderEn) {
  return {
    ciclo: ctx.ciclo,
    trimestre: ctx.trimestre,
    grado: ctx.grado,
    grupo: ctx.grupo,
    entrega: ctx.entrega,
    publicada: ctx.publicada,
    editable: ctx.editable,
  }
}

async function alumnosConProgreso(ctx: ContextoTeacherKinderEn) {
  const lista = await listarAlumnos({ grado: ctx.grado, grupoLetra: ctx.grupo, ciclo: ctx.ciclo })
  const progreso = await progresoAlumnos(
    lista.map((a) => a.alumno_id),
    ctx.grado as KinderEsGrado,
    ctx.trimestre,
    ctx.ciclo
  )
  return lista.map((a) => ({ ...a, progreso: progreso.get(a.alumno_id) ?? null }))
}

function valoresDeBody(raw: unknown): Record<number, string> {
  const out: Record<number, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[Number(k)] = String(v ?? '')
  return out
}

/** Sin alumnoId: alumnos del grupo con avance. Con alumnoId: su boleta del trimestre. */
export async function GET(req: Request, { params }: Params) {
  try {
    const url = new URL(req.url)
    const ctx = await contexto((await params).slug, req, {
      grado: url.searchParams.get('grado'),
      grupo: url.searchParams.get('grupo'),
      trimestre: url.searchParams.get('trimestre'),
    })
    const alumnoId = Number(url.searchParams.get('alumnoId') ?? 0)
    if (alumnoId) {
      await assertAlumnoDelGrupo(ctx, alumnoId)
      const captura = await obtenerCaptura({ alumnoId, bimestre: ctx.trimestre, ciclo: ctx.ciclo })
      return jsonOk({ ...estado(ctx), captura: capturaParaUi(captura) })
    }
    return jsonOk({ ...estado(ctx), alumnos: await alumnosConProgreso(ctx) })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const ctx = await contexto((await params).slug, req, body as Raw)
    assertEditable(ctx)
    const alumnoId = Number(body.alumnoId)
    await assertAlumnoDelGrupo(ctx, alumnoId)
    const result = await guardarCaptura({
      alumnoId,
      bimestre: ctx.trimestre,
      ciclo: ctx.ciclo,
      valores: valoresDeBody(body.academicos),
    })
    return jsonOk({ ok: true, ...result })
  } catch (e) {
    return jsonError(e, 400)
  }
}

/** Enviar el grupo a dirección. Si faltan calificaciones, avisa (409) salvo que venga `forzar`. */
export async function POST(req: Request, { params }: Params) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.accion !== 'enviar') {
      return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
    }
    const ctx = await contexto((await params).slug, req, body as Raw)
    assertEditable(ctx)
    const alumnos = await alumnosConProgreso(ctx)
    if (!alumnos.length) {
      return NextResponse.json({ error: 'Este grupo no tiene alumnos.' }, { status: 400 })
    }
    const faltan = alumnos
      .filter((a) => !a.progreso || a.progreso.capturadas < a.progreso.total)
      .map((a) => a.nombre)
    if (faltan.length && body.forzar !== true) {
      return NextResponse.json({ error: 'Faltan calificaciones.', code: 'incompleto', faltan }, { status: 409 })
    }
    const entrega = await enviarEntrega(
      { ciclo: ctx.ciclo, modulo: 'kinder-es', trimestre: ctx.trimestre, grado: ctx.grado, grupo: ctx.grupo },
      { maestroId: ctx.sesion.maestroId, nombre: ctx.sesion.nombre }
    )
    return jsonOk({ ...estado({ ...ctx, entrega, editable: false }), alumnos })
  } catch (e) {
    return jsonError(e, 400)
  }
}
