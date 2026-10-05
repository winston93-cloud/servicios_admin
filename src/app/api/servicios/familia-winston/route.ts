import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { cookieUsuariosValida } from '@/lib/usuariosCatalogoAuth'
import {
  aplicarFamiliaWinston,
  buscarComprobantesPorQr,
  guardarInicioClases,
  listarCiclosInicioClases,
  listarHistorialFamiliaWinston,
  revisarFamiliaWinston,
  textoCorreoFamiliaWinston,
} from '@/lib/familiaWinstonService'

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

export async function GET(request: Request) {
  const a = autorizar(request)
  if (!a.ok) return a.response
  try {
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
    if (!ctrl || !qr) {
      return NextResponse.json(
        { error: 'Escanea el código QR y elige al alumno que recomienda.' },
        { status: 400 }
      )
    }

    if (accion === 'revisar') {
      const revision = await revisarFamiliaWinston({ ctrl, qr, referidoRef })
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
      const r = await aplicarFamiliaWinston({ ctrl, qr, referidoRef, validadoPor: a.usuario })
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
