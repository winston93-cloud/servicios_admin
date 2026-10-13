import { NextResponse } from 'next/server'
import { encodeBoletasSession, opcionesCookieBoletas } from '@/lib/boletasAuth'
import { RacGoogleAuthError, verificarCredencialGoogle } from '@/lib/racGoogleIdToken'
import { cookieSimulacion, simuladorPorEmail, teacherPorEmail } from '@/lib/teamEnglish/teTeacherAuth'
import { equipo } from '@/lib/teamEnglish/teService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Google institucional:
 * - teacher del equipo (correo de boletas) → entra a su portal;
 * - coording / laura / mario → eligen a qué teacher simular (409 con candidatas, como RAC).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { idToken?: string; accessToken?: string; account?: { id?: number } }
    const { email } = await verificarCredencialGoogle({ idToken: body.idToken, accessToken: body.accessToken })

    const simulador = await simuladorPorEmail(email)
    if (simulador) {
      const teachers = (await Promise.all(simulador.niveles.map((n) => equipo(n, false)))).flat()
      const elegida = body.account?.id ? teachers.find((t) => t.maestro_id === Number(body.account?.id)) : null
      if (!elegida) {
        const candidates = [...teachers]
          .sort((a, b) => (a.grupos[0] ?? '9').localeCompare(b.grupos[0] ?? '9') || a.nombre.localeCompare(b.nombre, 'es'))
          .map((t) => ({
            tipo: 'maestro',
            id: t.maestro_id,
            role: 'maestro',
            perfil: 0,
            nombre: t.nombre,
            usuario: t.usuario ?? String(t.maestro_id),
            etiquetaRol: `${t.emoji} ${t.grupos.join(' · ') || 'Sin grupos'}`,
          }))
        if (!candidates.length) return NextResponse.json({ error: 'Aún no hay teachers en el equipo para simular.' }, { status: 404 })
        return NextResponse.json({ code: 'ambiguous', email, candidates }, { status: 409 })
      }
      const res = NextResponse.json({ ok: true })
      res.cookies.set(cookieSimulacion(elegida, simulador.nombre))
      return res
    }

    const t = await teacherPorEmail(email)
    if (!t) {
      await new Promise((r) => setTimeout(r, 600))
      return NextResponse.json(
        { error: `${email} no está registrado como teacher de inglés. Entra con tu usuario de boletas o pide a tu directora que actualice tu correo.` },
        { status: 403 },
      )
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(
      opcionesCookieBoletas(encodeBoletasSession({ role: 'maestro', id: t.maestro_id, nombre: t.nombre, usuario: t.usuario ?? String(t.maestro_id) })),
    )
    return res
  } catch (e) {
    if (e instanceof RacGoogleAuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('POST /api/team-english/teacher/google:', e)
    return NextResponse.json({ error: 'No se pudo entrar con Google.' }, { status: 500 })
  }
}
