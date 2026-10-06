import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { cookieUsuariosValida } from '@/lib/usuariosCatalogoAuth'
import {
  aplicarFamiliaWinston,
  buscarComprobantesPorQr,
  comprobanteDesdePdf,
  guardarInicioClases,
  listarCiclosInicioClases,
  listarHistorialFamiliaWinston,
  listarSeguimientoFamiliaWinston,
  revisarFamiliaWinston,
  textoCorreoFamiliaWinston,
  type PdfComprobanteFamiliaWinston,
} from '@/lib/familiaWinstonService'
import { leerComprobantePdf, PDF_MAX_BYTES } from '@/lib/familiaWinstonPdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 2026-10-05 — Familia Winston: sesión de personal + PIN (condona colegiaturas). */
function autorizar(request: Request):
  | { ok: true; usuario: string }
  | { ok: false; response: NextResponse } {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth
  if (!cookieUsuariosValida(request.headers.get('cookie'))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'PIN requerido para Familia Winston.' }, { status: 401 }),
    }
  }
  const s = auth.session
  return { ok: true, usuario: s.displayName || s.usuario_username || `Usuario ${s.usuario_id}` }
}

function entero(v: unknown): number | null {
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 2026-10-06 — Datos del PDF subido que el módulo reenvía al revisar/aplicar (se vuelven a cruzar). */
function pdfDelBody(v: unknown): PdfComprobanteFamiliaWinston | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  const folio = String(p.folio ?? '').trim().toUpperCase()
  // 2026-10-06: resultado de la revisión de «PDF modificado»
  const integ = (p.integridad ?? null) as Record<string, unknown> | null
  const nivel = integ && ['ok', 'aviso', 'error'].includes(String(integ.nivel)) ? (String(integ.nivel) as 'ok' | 'aviso' | 'error') : null
  return {
    qr: entero(p.qr),
    ctrl: entero(p.ctrl),
    interesado: String(p.interesado ?? '').trim().slice(0, 200) || null,
    folio: /^WSP-\d{5,}$/.test(folio) ? folio : null,
    integridad: nivel ? { nivel, texto: String(integ?.texto ?? '').trim().slice(0, 400) || null } : null,
  }
}

/** 2026-10-06 — Subir comprobante (PDF): lee QR, control e interesado y busca el comprobante. */
async function leerPdf(request: Request): Promise<NextResponse> {
  const form = await request.formData().catch(() => null)
  const archivo = form?.get('pdf')
  if (!archivo || typeof archivo === 'string') {
    return NextResponse.json({ error: 'Sube el comprobante en PDF.' }, { status: 400 })
  }
  if (archivo.size > PDF_MAX_BYTES) {
    return NextResponse.json({ error: 'El PDF pesa más de 4 MB.' }, { status: 413 })
  }
  let pdf: Awaited<ReturnType<typeof leerComprobantePdf>>
  try {
    pdf = await leerComprobantePdf(new Uint8Array(await archivo.arrayBuffer()))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo leer el PDF.' },
      { status: 422 }
    )
  }
  const { item, error } = await comprobanteDesdePdf(pdf)
  if (error || !item) return NextResponse.json({ error, pdf }, { status: 422 })
  return NextResponse.json({ ok: true, pdf, comprobante: item })
}

export async function GET(request: Request) {
  const a = autorizar(request)
  if (!a.ok) return a.response
  try {
    // 2026-10-06 — Seguimiento (pendientes y aplicados con ciclo y estado); solo lectura.
    if (new URL(request.url).searchParams.get('vista') === 'seguimiento') {
      return NextResponse.json({ ok: true, ...(await listarSeguimientoFamiliaWinston()) })
    }
    const [historial, ciclos] = await Promise.all([
      listarHistorialFamiliaWinston(),
      listarCiclosInicioClases(),
    ])
    return NextResponse.json({ ok: true, ...historial, ciclos })
  } catch (e) {
    console.error('GET /api/servicios/familia-winston:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al consultar Familia Winston' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const a = autorizar(request)
  if (!a.ok) return a.response
  try {
    // 2026-10-06 — El PDF llega como multipart; el resto de acciones, JSON.
    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      return await leerPdf(request)
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const accion = String(body.accion ?? '')

    if (accion === 'inicio-clases') {
      const valor = entero(body.ciclo)
      const fecha = String(body.fecha ?? '')
      if (!valor) return NextResponse.json({ error: 'Ciclo inválido.' }, { status: 400 })
      await guardarInicioClases(valor, fecha)
      return NextResponse.json({ ok: true, ciclos: await listarCiclosInicioClases() })
    }

    // 2026-10-05 — Al escanear: comprobantes con ese QR para llenar «quién recomendó».
    if (accion === 'qr') {
      const qrBuscado = entero(body.qr)
      if (!qrBuscado) return NextResponse.json({ error: 'Código QR inválido.' }, { status: 400 })
      return NextResponse.json({ ok: true, comprobantes: await buscarComprobantesPorQr(qrBuscado) })
    }

    const ctrl = entero(body.ctrl)
    const qr = entero(body.qr)
    const referidoRef = entero(body.referidoRef)
    // 2026-10-05 — Mes a condonar elegido en el módulo (concepto 01…10/26); vacío = próximo pendiente.
    const conceptoNo = /^\d{1,2}$/.test(String(body.conceptoNo ?? '').trim())
      ? String(body.conceptoNo).trim()
      : null
    // 2026-10-06 — Nombre del interesado escrito del PDF (comprobantes viejos sin interesado guardado).
    const interesadoPdf = String(body.interesadoPdf ?? '').trim().slice(0, 200) || null
    const pdf = pdfDelBody(body.pdf)
    if (!ctrl || !qr) {
      return NextResponse.json(
        { error: 'Escanea el código QR y elige al alumno que recomienda.' },
        { status: 400 }
      )
    }

    if (accion === 'revisar') {
      const revision = await revisarFamiliaWinston({ ctrl, qr, referidoRef, conceptoNo, interesadoPdf, pdf })
      const correoPreview =
        revision.beneficiado && revision.mesPropuesto && revision.destinatarios.length > 0
          ? textoCorreoFamiliaWinston({
              beneficiado: revision.beneficiado,
              destinatarios: revision.destinatarios,
              mes: revision.mesPropuesto,
            })
          : null
      return NextResponse.json({ ok: true, revision, correoPreview })
    }

    if (accion === 'aplicar') {
      if (!referidoRef) {
        return NextResponse.json(
          { error: 'Falta la matrícula del alumno recomendado.' },
          { status: 400 }
        )
      }
      const r = await aplicarFamiliaWinston({
        ctrl,
        qr,
        referidoRef,
        conceptoNo,
        interesadoPdf,
        pdf,
        validadoPor: a.usuario,
      })
      if (!r.ok) return NextResponse.json({ error: r.mensaje, revision: r.revision }, { status: 409 })
      return NextResponse.json(r)
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
  } catch (e) {
    console.error('POST /api/servicios/familia-winston:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error en Familia Winston' },
      { status: 500 }
    )
  }
}
