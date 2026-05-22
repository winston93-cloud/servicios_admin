import { NextResponse } from 'next/server'
import { enviarCorreoMasivo, htmlCuerpoCorreoMasivo } from '@/lib/emailServicios'
import {
  listarDestinatariosCorreoMasivo,
  type DestinatarioCorreoMasivo,
  type EstadoEnvioCorreo,
  type FiltroAdicionalCorreo,
} from '@/lib/correoMasivoService'

export const runtime = 'nodejs'
export const maxDuration = 300

const FILTROS_VALIDOS: FiltroAdicionalCorreo[] = [
  'sin-filtro',
  'becados',
  'nuevo-ingreso',
  'reinscritos',
]

function parseFiltrosJson(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function mapEstadoDesdeEnvio(
  ok: boolean,
  accepted: string[] | undefined,
  emails: string[]
): { estado: EstadoEnvioCorreo; mensaje: string } {
  if (!emails.length) {
    return { estado: 'sin-correo', mensaje: 'Sin correo autorizado' }
  }
  if (!ok) {
    return { estado: 'error', mensaje: 'No se pudo entregar al servidor de correo' }
  }
  const aceptados = (accepted ?? []).length
  if (aceptados >= emails.length) {
    return {
      estado: 'recibido',
      mensaje: `Recibido por el servidor (${aceptados} dirección/es)`,
    }
  }
  if (aceptados > 0) {
    return {
      estado: 'enviado',
      mensaje: `Enviado parcialmente (${aceptados}/${emails.length})`,
    }
  }
  return { estado: 'enviado', mensaje: 'Enviado al servidor de correo' }
}

export async function POST(request: Request) {
  const form = await request.formData()
  const asunto = String(form.get('asunto') ?? '').trim()
  const mensaje = String(form.get('mensaje') ?? '').trim()
  const filtrosRaw = parseFiltrosJson(String(form.get('filtros') ?? ''))

  if (!asunto || !mensaje) {
    return NextResponse.json({ error: 'Asunto y mensaje son obligatorios' }, { status: 400 })
  }

  const ciclo = Number(filtrosRaw?.cicloEscolar)
  if (!ciclo || Number.isNaN(ciclo)) {
    return NextResponse.json({ error: 'Ciclo escolar inválido' }, { status: 400 })
  }

  const filtroAdicional = FILTROS_VALIDOS.includes(
    filtrosRaw?.filtroAdicional as FiltroAdicionalCorreo
  )
    ? (filtrosRaw!.filtroAdicional as FiltroAdicionalCorreo)
    : 'sin-filtro'

  let destinatarios = await listarDestinatariosCorreoMasivo({
    cicloEscolar: ciclo,
    nivel: filtrosRaw?.nivel ? Number(filtrosRaw.nivel) : null,
    grado: filtrosRaw?.grado ? Number(filtrosRaw.grado) : null,
    grupo: filtrosRaw?.grupo ? Number(filtrosRaw.grupo) : null,
    filtroAdicional,
  })

  const soloIds = filtrosRaw?.soloAlumnoIds
  if (Array.isArray(soloIds) && soloIds.length > 0) {
    const permitidos = new Set(soloIds.map((id) => Number(id)).filter((id) => id > 0))
    destinatarios = destinatarios.filter((d) => permitidos.has(d.alumno_id))
  }

  const archivos = form.getAll('archivos').filter((f): f is File => f instanceof File)
  const attachments: { filename: string; content: Buffer; contentType?: string }[] = []

  for (const file of archivos) {
    if (!file.size) continue
    const buf = Buffer.from(await file.arrayBuffer())
    attachments.push({
      filename: file.name,
      content: buf,
      contentType: file.type || undefined,
    })
  }

  const resultados: DestinatarioCorreoMasivo[] = []
  let enviados = 0
  let errores = 0
  let sinCorreo = 0

  for (const dest of destinatarios) {
    if (!dest.emails.length) {
      sinCorreo++
      resultados.push({
        ...dest,
        estado: 'sin-correo',
        mensaje_estado: 'Sin correo autorizado (padre/madre)',
      })
      continue
    }

    const html = htmlCuerpoCorreoMasivo(mensaje, dest.nivel)
    const res = await enviarCorreoMasivo({
      to: dest.emails,
      subject: asunto,
      html,
      nivel: dest.nivel,
      attachments: attachments.length ? attachments : undefined,
    })

    const { estado, mensaje: msgEstado } = mapEstadoDesdeEnvio(
      res.ok,
      res.accepted,
      dest.emails
    )

    if (estado === 'error') errores++
    else if (estado === 'sin-correo') sinCorreo++
    else enviados++

    resultados.push({
      ...dest,
      estado,
      mensaje_estado: res.error ?? msgEstado,
    })

    await new Promise((r) => setTimeout(r, 120))
  }

  return NextResponse.json({
    ok: errores === 0,
    resumen: {
      total: resultados.length,
      enviados,
      errores,
      sinCorreo,
    },
    resultados,
  })
}
