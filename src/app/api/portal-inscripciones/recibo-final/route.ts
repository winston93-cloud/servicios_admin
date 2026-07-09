import { NextResponse } from 'next/server'
import { urlReciboFinalLegacy } from '@/lib/portalAdmisionesEstadoService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'

export const runtime = 'nodejs'

/** Redirige al recibo final legacy vía POST auto-enviado (como admisiones/module/loader.php). */
export async function GET(request: Request) {
  const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
  const auth = await validarAlumnoPortal(alumnoId)
  if (!auth.ok) return auth.response

  const a = auth.alumno
  const action = urlReciboFinalLegacy()
  const nombre = String(a.alumno_nombre ?? '')
  const app = String(a.alumno_app ?? '')
  const apm = String(a.alumno_apm ?? '')
  const ref = String(a.alumno_ref ?? '')
  const nivel = String(a.alumno_nivel ?? '')

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Recibo final</title></head>
<body>
<p>Generando recibo final…</p>
<form id="f" method="POST" action="${action}" target="_blank">
  <input type="hidden" name="alumno" value="${ref}" />
  <input type="hidden" name="nombre" value="${nombre.replace(/"/g, '&quot;')}" />
  <input type="hidden" name="app" value="${app.replace(/"/g, '&quot;')}" />
  <input type="hidden" name="apm" value="${apm.replace(/"/g, '&quot;')}" />
  <input type="hidden" name="nivel" value="${nivel}" />
</form>
<script>document.getElementById('f').submit();</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
