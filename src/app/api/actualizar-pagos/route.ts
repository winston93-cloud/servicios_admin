import { NextResponse } from 'next/server'
import {
  ARCHIVOS_PAGO_EFECTIVO,
  esArchivoPagoEfectivoPermitido,
  procesarCargaPagosEfectivo,
  type ArchivoPagoEfectivo,
} from '@/lib/actualizarPagosEfectivo'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 300

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase()
}

export async function GET() {
  return NextResponse.json({
    archivosPermitidos: ARCHIVOS_PAGO_EFECTIVO,
    descripcion:
      'Carga de pagos en efectivo desde colegiaturas.txt e inscripciones.txt (formato pipe |).',
  })
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario de carga' }, { status: 400 })
  }

  const recibidos: { nombreOriginal: string; nombre: ArchivoPagoEfectivo; contenido: string }[] = []
  const rechazados: string[] = []
  const faltantes: string[] = []

  const entradas = formData.getAll('file')
  if (!entradas.length) {
    return NextResponse.json(
      {
        error:
          'No se enviaron archivos. Sube al menos uno: colegiaturas.txt o inscripciones.txt.',
      },
      { status: 400 }
    )
  }

  const vistos = new Set<ArchivoPagoEfectivo>()

  for (const entrada of entradas) {
    if (!(entrada instanceof File)) continue
    const nombreOriginal = entrada.name
    const nombreNorm = normalizarNombre(nombreOriginal)

    if (!esArchivoPagoEfectivoPermitido(nombreNorm)) {
      rechazados.push(nombreOriginal)
      continue
    }

    if (vistos.has(nombreNorm)) {
      rechazados.push(`${nombreOriginal} (duplicado en la solicitud)`)
      continue
    }

    const buffer = await entrada.arrayBuffer()
    const contenido = new TextDecoder('latin1').decode(buffer)
    if (!contenido.trim()) {
      rechazados.push(`${nombreOriginal} (archivo vacío)`)
      continue
    }

    vistos.add(nombreNorm)
    recibidos.push({ nombreOriginal, nombre: nombreNorm, contenido })
  }

  for (const esperado of ARCHIVOS_PAGO_EFECTIVO) {
    if (!vistos.has(esperado)) faltantes.push(esperado)
  }

  if (!recibidos.length) {
    return NextResponse.json(
      {
        error: 'Ningún archivo válido.',
        archivosPermitidos: ARCHIVOS_PAGO_EFECTIVO,
        rechazados,
        faltantes,
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createSupabaseAdmin()
    const resultado = await procesarCargaPagosEfectivo(
      supabase,
      recibidos.map((r) => ({ nombre: r.nombre, contenido: r.contenido }))
    )

    return NextResponse.json({
      ...resultado,
      recibidos: recibidos.map((r) => r.nombreOriginal),
      rechazados,
      faltantes,
      advertenciaFaltantes:
        faltantes.length > 0
          ? `Se procesaron archivos parciales. Faltaron: ${faltantes.join(', ')}`
          : null,
    })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error('actualizar-pagos:', e)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
