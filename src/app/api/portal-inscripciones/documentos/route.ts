import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import {
  nivelGradoDocumentosAdmision,
  requiereDocumentosAdmision,
} from '@/lib/portalDocumentosAdmision'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import { calcularReinscripcionDiferido } from '@/lib/portalReinscripcionService'
import {
  enviarDocumentosNiDesdeStorage,
  obtenerUltimoEnvioDocumentosNi,
  subirDocumentoNiTemporal,
  validarArchivoPdf,
  validarExpedienteDocumentosNi,
  type DocumentoNiSubidaTemp,
} from '@/lib/portalDocumentosNiService'
import {
  documentosNiRequeridosPorNivelGrado,
  correoControlEscolarPorNivel,
  esDocumentoNiTipoId,
} from '@/lib/portalDocumentosNiTipos'

export const runtime = 'nodejs'

function nombreAlumno(a: {
  alumno_nombre?: string | null
  alumno_app?: string | null
  alumno_apm?: string | null
}): string {
  return `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim() || 'Alumno'
}

async function contextoNi(alumnoId: number) {
  const auth = await validarAlumnoPortal(alumnoId)
  if (!auth.ok) return { ok: false as const, response: auth.response }

  if (!requiereDocumentosAdmision(auth.alumno)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'La carga de documentos solo aplica a nuevo ingreso o reinscritos con cambio de nivel (Kinder 3 → 1º / 6º → secundaria).',
        },
        { status: 403 }
      ),
    }
  }

  const cicloSistema = await obtenerCicloEscolarActual()
  if (!cicloSistema) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'No hay ciclo escolar vigente.' }, { status: 503 }),
    }
  }

  const client = createInsforgeAdmin()
  const calc = await calcularReinscripcionDiferido(client.database, auth.alumno)
  const ciclo = await resolverCicloPagoInscripcionPortal(
    auth.alumno,
    cicloSistema,
    calc?.cicloReinscripcion
  )
  const { nivel, grado } = nivelGradoDocumentosAdmision(auth.alumno)
  if (!correoControlEscolarPorNivel(nivel)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Nivel escolar no válido para el envío.' },
        { status: 400 }
      ),
    }
  }

  return { ok: true as const, alumno: auth.alumno, ciclo, nivel, grado }
}

export async function GET(request: Request) {
  try {
    const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
    const ctx = await contextoNi(alumnoId)
    if (!ctx.ok) return ctx.response

    const client = createInsforgeAdmin()
    const envio = await obtenerUltimoEnvioDocumentosNi(
      client.database,
      alumnoId,
      Number(ctx.ciclo.valor)
    )

    return NextResponse.json({
      ok: true,
      alumno: {
        alumnoId: ctx.alumno.alumno_id,
        alumnoRef: ctx.alumno.alumno_ref,
        nombre: nombreAlumno(ctx.alumno),
        nivel: ctx.nivel,
        grado: ctx.grado,
        nivelEtiqueta: etiquetaNivelEscolar(ctx.nivel),
        gradoEtiqueta: etiquetaGradoEscolar(ctx.nivel, ctx.grado),
      },
      ciclo: { valor: ctx.ciclo.valor, nombre: ctx.ciclo.nombre },
      requisitos: documentosNiRequeridosPorNivelGrado(ctx.nivel, ctx.grado),
      correoDestino: correoControlEscolarPorNivel(ctx.nivel),
      enviado: Boolean(envio),
      envio: envio
        ? {
            id: envio.id,
            enviadoAt: envio.enviado_at,
            correoDestino: envio.correo_destino,
            documentos: envio.documentos,
          }
        : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar documentos'
    console.error('portal-inscripciones/documentos GET:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Sube un solo PDF (evita el límite de 4.5 MB de Vercel al mandar varios juntos). */
export async function PUT(request: Request) {
  try {
    const form = await request.formData()
    const alumnoId = Number(form.get('alumnoId'))
    const tipoRaw = String(form.get('tipo') ?? '')
    const file = form.get('archivo')

    const ctx = await contextoNi(alumnoId)
    if (!ctx.ok) return ctx.response

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'archivo PDF requerido' }, { status: 400 })
    }

    const check = validarArchivoPdf(file, tipoRaw)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const requeridos = documentosNiRequeridosPorNivelGrado(ctx.nivel, ctx.grado)
    if (!requeridos.some((r) => r.id === check.tipo)) {
      return NextResponse.json(
        { error: 'Ese documento no es requerido para este grado.' },
        { status: 400 }
      )
    }

    const client = createInsforgeAdmin()
    const subida = await subirDocumentoNiTemporal({
      client,
      alumnoId: ctx.alumno.alumno_id,
      cicloValor: Number(ctx.ciclo.valor),
      tipo: check.tipo,
      buffer: Buffer.from(await file.arrayBuffer()),
      nombreArchivo: file.name,
    })

    return NextResponse.json({ ok: true, subida })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir documento'
    console.error('portal-inscripciones/documentos PUT:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Confirma los archivos ya subidos y los envía por correo a control escolar. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const subidasRaw = Array.isArray(body.subidas) ? body.subidas : []

    const ctx = await contextoNi(alumnoId)
    if (!ctx.ok) return ctx.response

    const subidas: DocumentoNiSubidaTemp[] = []
    for (const item of subidasRaw) {
      const tipo = String(item?.tipo ?? '')
      if (!esDocumentoNiTipoId(tipo)) {
        return NextResponse.json({ error: `Tipo inválido: ${tipo}` }, { status: 400 })
      }
      const storageKey = String(item?.storageKey ?? '')
      if (!storageKey) {
        return NextResponse.json({ error: `Falta storageKey para ${tipo}` }, { status: 400 })
      }
      const size = Number(item?.size) || 0
      if (size <= 0) {
        return NextResponse.json(
          { error: `El archivo de "${tipo}" está vacío. Carga un PDF válido.` },
          { status: 400 }
        )
      }
      subidas.push({
        tipo,
        etiqueta: String(item?.etiqueta ?? tipo),
        nombreArchivo: String(item?.nombreArchivo ?? `${tipo}.pdf`),
        storageKey,
        storageUrl: String(item?.storageUrl ?? ''),
        size,
      })
    }

    const validacion = validarExpedienteDocumentosNi({
      nivel: ctx.nivel,
      grado: ctx.grado,
      subidas,
    })
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 })
    }

    const client = createInsforgeAdmin()
    const envio = await enviarDocumentosNiDesdeStorage({
      client,
      alumnoId: ctx.alumno.alumno_id,
      alumnoRef: Number(ctx.alumno.alumno_ref),
      alumnoNombre: nombreAlumno(ctx.alumno),
      nivel: ctx.nivel,
      grado: ctx.grado,
      cicloValor: Number(ctx.ciclo.valor),
      cicloNombre: ctx.ciclo.nombre,
      subidas,
    })

    return NextResponse.json({
      ok: true,
      enviado: true,
      envio: {
        id: envio.id,
        enviadoAt: envio.enviado_at,
        correoDestino: envio.correo_destino,
        documentos: envio.documentos,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar documentos'
    console.error('portal-inscripciones/documentos POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
