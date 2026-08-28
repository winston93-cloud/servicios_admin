import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import {
  eliminarPaqueteFielServidor,
  guardarPaqueteFielServidor,
  listarPaquetesFielServidor,
} from '@/lib/sat/satFielPaqueteService'
import { bufferDesdeUpload } from '@/lib/sat/satFiel'

export const runtime = 'nodejs'

function etiquetaCreador(session: {
  displayName?: string
  usuario_username?: string
}): string {
  return session.usuario_username?.trim() || session.displayName?.trim() || 'empleado'
}

export async function GET(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const paquetes = await listarPaquetesFielServidor(createDbAdmin())
    return NextResponse.json({ ok: true, paquetes })
  } catch (e) {
    console.error('sat/fiel-paquetes GET:', e)
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'No se pudieron listar los paquetes.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const form = await request.formData()
    const id = String(form.get('id') ?? '').trim() || undefined
    const nombre = String(form.get('nombre') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const cer = await bufferDesdeUpload(form.get('cer'))
    const key = await bufferDesdeUpload(form.get('key'))
    const cerNombre = String(form.get('cerNombre') ?? '').trim()
    const keyNombre = String(form.get('keyNombre') ?? '').trim()

    if (!cer?.length || !key?.length) {
      return NextResponse.json(
        { ok: false, error: 'Suba archivos .cer y .key.' },
        { status: 400 }
      )
    }

    const paquete = await guardarPaqueteFielServidor(createDbAdmin(), {
      id,
      nombre,
      cer,
      key,
      cerNombre: cerNombre || 'certificado.cer',
      keyNombre: keyNombre || 'clave.key',
      password,
      creadoPor: etiquetaCreador(auth.session),
    })

    return NextResponse.json({ ok: true, paquete })
  } catch (e) {
    console.error('sat/fiel-paquetes POST:', e)
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'No se pudo guardar el paquete.',
      },
      { status: 400 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const id = new URL(request.url).searchParams.get('id')?.trim()
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Falta id del paquete.' },
        { status: 400 }
      )
    }

    await eliminarPaqueteFielServidor(createDbAdmin(), id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('sat/fiel-paquetes DELETE:', e)
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'No se pudo eliminar el paquete.',
      },
      { status: 400 }
    )
  }
}
