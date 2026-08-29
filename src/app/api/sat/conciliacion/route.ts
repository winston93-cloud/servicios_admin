import { NextResponse } from 'next/server'
import { requireSatModuloSesion } from '@/lib/sat/satModuloAuth'
import { leerBanorteTxt } from '@/lib/sat/conciliacion/parseBanorteTxt'
import { leerClaraCsv } from '@/lib/sat/conciliacion/parseClaraCsv'
import { leerCfdiRecibidosExcel } from '@/lib/sat/conciliacion/parseCfdiRecibidosExcel'
import { ejecutarConciliacion } from '@/lib/sat/conciliacion/satConciliacionService'
import { generarExcelConciliacion } from '@/lib/sat/conciliacion/satConciliacionExcel'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES = 25 * 1024 * 1024

async function bufferDesdeUpload(raw: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(raw instanceof File) || !raw.size) return null
  if (raw.size > MAX_BYTES) {
    throw new Error(`Archivo demasiado grande (máx. ${MAX_BYTES / (1024 * 1024)} MB).`)
  }
  return Buffer.from(await raw.arrayBuffer())
}

export async function POST(request: Request) {
  try {
    const auth = requireSatModuloSesion(request)
    if (!auth.ok) return auth.response

    const form = await request.formData()
    const cfdiBuf = await bufferDesdeUpload(form.get('cfdiExcel'))
    const banorteBuf = await bufferDesdeUpload(form.get('banorteTxt'))
    const claraBuf = await bufferDesdeUpload(form.get('claraCsv'))

    if (!cfdiBuf) {
      return NextResponse.json(
        { ok: false, error: 'Suba el Excel de CFDI recibidos.' },
        { status: 400 }
      )
    }
    if (!banorteBuf) {
      return NextResponse.json(
        { ok: false, error: 'Suba el archivo TXT de Banorte.' },
        { status: 400 }
      )
    }
    if (!claraBuf) {
      return NextResponse.json(
        { ok: false, error: 'Suba el archivo CSV de Clara.' },
        { status: 400 }
      )
    }

    const cfdiFilas = await leerCfdiRecibidosExcel(cfdiBuf)
    const banorte = leerBanorteTxt(banorteBuf)
    const clara = leerClaraCsv(claraBuf)

    const nombreCfdi = String(form.get('nombreCfdi') ?? 'cfdi-recibidos.xlsx')
    const nombreBanorte = String(form.get('nombreBanorte') ?? 'banorte.txt')
    const nombreClara = String(form.get('nombreClara') ?? 'clara.csv')

    const resultado = ejecutarConciliacion({
      cfdiFilas,
      banorte,
      clara,
      nombres: {
        cfdi: nombreCfdi,
        banorte: nombreBanorte,
        clara: nombreClara,
      },
    })

    const excel = await generarExcelConciliacion(resultado)
    const stamp = new Date().toISOString().slice(0, 10)
    const nombre = `conciliacion-cfdi_${stamp}.xlsx`

    return new NextResponse(new Uint8Array(excel), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'X-Conciliacion-Total': String(resultado.resumen.totalFacturas),
        'X-Conciliacion-Ok': String(resultado.resumen.conciliadas),
        'X-Conciliacion-Pendiente': String(resultado.resumen.noLocalizadas),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al conciliar archivos.'
    console.error('sat/conciliacion:', err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
