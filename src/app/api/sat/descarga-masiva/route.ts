import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { generarExcelCfdiRecibidos } from '@/lib/sat/cfdiRecibidosExcel'
import { mensajeErrorSat, SatDescargaError } from '@/lib/sat/satDescargaErrors'
import {
  descargarYExtraerCfdiRecibidos,
  solicitarDescargaRecibidos,
  verificarSolicitudDescarga,
} from '@/lib/sat/satDescargaMasivaService'
import { crearFielDesdeUpload, bufferDesdeUpload } from '@/lib/sat/satFiel'

export const runtime = 'nodejs'
export const maxDuration = 300

type Accion = 'solicitar' | 'verificar' | 'descargar'

async function leerFielDesdeForm(form: FormData) {
  const cer = await bufferDesdeUpload(form.get('cer'))
  const key = await bufferDesdeUpload(form.get('key'))
  const password = String(form.get('password') ?? '')

  return crearFielDesdeUpload({
    cer: cer ?? Buffer.alloc(0),
    key: key ?? Buffer.alloc(0),
    password,
  })
}

export async function POST(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const form = await request.formData()
    const accion = String(form.get('accion') ?? '').trim() as Accion

    if (!['solicitar', 'verificar', 'descargar'].includes(accion)) {
      return NextResponse.json(
        { ok: false, error: 'Acción inválida. Use solicitar, verificar o descargar.' },
        { status: 400 }
      )
    }

    const fiel = await leerFielDesdeForm(form)

    if (accion === 'solicitar') {
      const fechaInicio = String(form.get('fechaInicio') ?? '').trim()
      const fechaFin = String(form.get('fechaFin') ?? '').trim()
      const resultado = await solicitarDescargaRecibidos(
        fiel,
        fechaInicio,
        fechaFin
      )
      return NextResponse.json({
        ok: true,
        etapa: 'solicitud_enviada',
        ...resultado,
        mensaje:
          'Solicitud enviada al SAT. Espere unos segundos y verifique disponibilidad.',
      })
    }

    const idSolicitud = String(form.get('idSolicitud') ?? '').trim()
    if (!idSolicitud) {
      return NextResponse.json(
        { ok: false, error: 'Falta idSolicitud.' },
        { status: 400 }
      )
    }

    if (accion === 'verificar') {
      const ver = await verificarSolicitudDescarga(fiel, idSolicitud)
      return NextResponse.json({ ok: true, ...ver })
    }

    const rawPaquetes = String(form.get('paquetes') ?? '[]')
    let paquetes: string[] = []
    try {
      paquetes = JSON.parse(rawPaquetes) as string[]
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Lista de paquetes inválida.' },
        { status: 400 }
      )
    }

    const filas = await descargarYExtraerCfdiRecibidos(fiel, paquetes)
    const fechaInicio = String(form.get('fechaInicio') ?? '').trim()
    const fechaFin = String(form.get('fechaFin') ?? '').trim()

    const excel = await generarExcelCfdiRecibidos(filas, {
      rfcReceptor: fiel.rfc,
      desde: fechaInicio,
      hasta: fechaFin,
    })

    const nombre = `cfdi-recibidos_${fiel.rfc}_${fechaInicio}_${fechaFin}.xlsx`
    return new NextResponse(new Uint8Array(excel), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'X-Cfdi-Count': String(filas.length),
      },
    })
  } catch (err) {
    const status = err instanceof SatDescargaError ? err.status : 500
    const code = err instanceof SatDescargaError ? err.code : 'SAT_ERROR'
    const detail =
      err instanceof SatDescargaError
        ? err.detail
        : err instanceof Error
          ? err.message
          : undefined

    console.error('sat/descarga-masiva:', {
      code,
      status,
      detail,
      error: err,
    })

    return NextResponse.json(
      {
        ok: false,
        error: mensajeErrorSat(err),
        code,
        detail: detail ?? null,
      },
      { status }
    )
  }
}
