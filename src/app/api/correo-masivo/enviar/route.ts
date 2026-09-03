import { NextResponse } from 'next/server'
import {
  descargarAdjuntosTemporales,
  eliminarAdjuntosTemporales,
  esTokenAdjuntosValido,
} from '@/lib/correoMasivoAdjuntosStorage'
import {
  enviarCorreoMasivo,
  htmlCuerpoCorreoMasivo,
  parsearListaCorreos,
  type AdjuntoCorreo,
} from '@/lib/emailServicios'
import {
  listarDestinatariosCorreoMasivo,
  obtenerDestinatariosPorAlumnoIds,
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

function parseNombresAdjuntosJson(raw: string): string[] {
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((n) => String(n ?? '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  const form = await request.formData()
  const asunto = String(form.get('asunto') ?? '').trim()
  const mensaje = String(form.get('mensaje') ?? '').trim()
  const ccLista = parsearListaCorreos(String(form.get('cc') ?? ''))
  const filtrosRaw = parseFiltrosJson(String(form.get('filtros') ?? ''))

  if (!asunto || !mensaje) {
    return NextResponse.json({ error: 'Asunto y mensaje son obligatorios' }, { status: 400 })
  }

  const ccRaw = String(form.get('cc') ?? '').trim()
  if (ccRaw && !ccLista.length) {
    return NextResponse.json(
      { error: 'El campo Con copia (CC) no tiene correos válidos.' },
      { status: 400 }
    )
  }

  const soloIds = Array.isArray(filtrosRaw?.soloAlumnoIds)
    ? (filtrosRaw!.soloAlumnoIds as unknown[])
        .map((id) => Number(id))
        .filter((id) => id > 0)
    : []
  const modoIndividual = String(filtrosRaw?.modo ?? '') === 'individual'

  let destinatarios: DestinatarioCorreoMasivo[]

  if (modoIndividual) {
    if (!soloIds.length) {
      return NextResponse.json(
        { error: 'Selecciona un alumno para el envío individual.' },
        { status: 400 }
      )
    }
    destinatarios = await obtenerDestinatariosPorAlumnoIds(soloIds)
  } else {
    const ciclo = Number(filtrosRaw?.cicloEscolar)
    if (!ciclo || Number.isNaN(ciclo)) {
      return NextResponse.json({ error: 'Ciclo escolar inválido' }, { status: 400 })
    }

    const filtroAdicional = FILTROS_VALIDOS.includes(
      filtrosRaw?.filtroAdicional as FiltroAdicionalCorreo
    )
      ? (filtrosRaw!.filtroAdicional as FiltroAdicionalCorreo)
      : 'sin-filtro'

    destinatarios = await listarDestinatariosCorreoMasivo({
      cicloEscolar: ciclo,
      nivel: filtrosRaw?.nivel ? Number(filtrosRaw.nivel) : null,
      grado: filtrosRaw?.grado ? Number(filtrosRaw.grado) : null,
      grupo: filtrosRaw?.grupo ? Number(filtrosRaw.grupo) : null,
      filtroAdicional,
    })

    if (soloIds.length > 0) {
      const permitidos = new Set(soloIds)
      destinatarios = destinatarios.filter((d) => permitidos.has(d.alumno_id))
    }
  }

  const adjuntosToken = String(form.get('adjuntosToken') ?? '').trim()
  const nombresAdjuntos = parseNombresAdjuntosJson(String(form.get('adjuntosNombres') ?? ''))
  let attachments: AdjuntoCorreo[] = []
  let pesoAdjuntosBytes = 0
  let adjuntosDesdeStorage = false

  if (adjuntosToken) {
    if (!esTokenAdjuntosValido(adjuntosToken)) {
      return NextResponse.json({ error: 'Token de adjuntos inválido' }, { status: 400 })
    }
    try {
      attachments = await descargarAdjuntosTemporales(
        adjuntosToken,
        nombresAdjuntos.length ? nombresAdjuntos : undefined
      )
      adjuntosDesdeStorage = true
      pesoAdjuntosBytes = attachments.reduce((s, a) => s + a.content.length, 0)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron leer los adjuntos'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    if (!attachments.length) {
      return NextResponse.json(
        { error: 'No hay adjuntos en almacenamiento temporal. Vuelva a subirlos.' },
        { status: 400 }
      )
    }
  } else {
    const archivos = form.getAll('archivos').filter((f): f is File => f instanceof File)
    for (const file of archivos) {
      if (!file.size) continue
      pesoAdjuntosBytes += file.size
      const buf = Buffer.from(await file.arrayBuffer())
      attachments.push({
        filename: file.name,
        content: buf,
        contentType: file.type || undefined,
      })
    }
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
      cc: ccLista.length ? ccLista : undefined,
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
  }

  if (adjuntosDesdeStorage && adjuntosToken) {
    try {
      await eliminarAdjuntosTemporales(adjuntosToken)
    } catch (e) {
      console.error('correo-masivo/enviar cleanup:', e)
    }
  }

  return NextResponse.json({
    ok: errores === 0,
    adjuntosRecibidos: attachments.length,
    pesoAdjuntosBytes,
    adjuntosDesdeStorage,
    resumen: {
      total: resultados.length,
      enviados,
      errores,
      sinCorreo,
    },
    resultados,
  })
}
