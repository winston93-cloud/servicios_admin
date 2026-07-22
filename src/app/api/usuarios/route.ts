import { NextResponse } from 'next/server'
import {
  actualizarUsuarioAdmin,
  crearUsuarioAdmin,
  eliminarUsuarioAdmin,
  listarUsuariosAdmin,
} from '@/lib/usuarioCatalogoService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const usuarios = await listarUsuariosAdmin()
    return NextResponse.json({ usuarios })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al listar usuarios'
    console.error('GET /api/usuarios:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const usuario = await crearUsuarioAdmin(body ?? {})
    return NextResponse.json({ ok: true, usuario }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al crear usuario'
    console.error('POST /api/usuarios:', e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const id = Number(body?.usuario_id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 })
    }
    const usuario = await actualizarUsuarioAdmin(id, body ?? {})
    return NextResponse.json({ ok: true, usuario })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al actualizar usuario'
    console.error('PUT /api/usuarios:', e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    await eliminarUsuarioAdmin(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al eliminar usuario'
    console.error('DELETE /api/usuarios:', e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
