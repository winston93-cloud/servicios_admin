import { NextResponse } from 'next/server'
import { cookiePosValida } from '@/lib/posAuth'
import {
  PosError,
  buscarClientes,
  cancelarPartidas,
  eliminarExterno,
  guardarExterno,
  guardarProducto,
  historialCliente,
  listarExternos,
  listarProductos,
  marcarEntrega,
  pagosDelDia,
  registrarVenta,
  reporteContable,
} from '@/lib/pos/posServidor'
import { fechaMx } from '@/lib/pos/posTipos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ accion: string }> }

function noAutorizado() {
  return NextResponse.json({ error: 'Sesión de caja expirada. Vuelve a ingresar la contraseña.' }, { status: 401 })
}

function responderError(e: unknown) {
  if (e instanceof PosError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error('[api/pos]', e)
  return NextResponse.json({ error: 'Error inesperado en el punto de venta.' }, { status: 500 })
}

export async function GET(request: Request, ctx: Ctx) {
  if (!cookiePosValida(request.headers.get('cookie'))) return noAutorizado()
  const { accion } = await ctx.params
  const url = new URL(request.url)
  try {
    switch (accion) {
      case 'buscar':
        return NextResponse.json(await buscarClientes(url.searchParams.get('q') ?? ''))
      case 'productos':
        return NextResponse.json({
          productos: await listarProductos(url.searchParams.get('todos') === '1'),
        })
      case 'externos':
        return NextResponse.json({ externos: await listarExternos() })
      case 'dia':
        return NextResponse.json({
          pagos: await pagosDelDia(url.searchParams.get('fecha') || fechaMx()),
        })
      case 'historial':
        return NextResponse.json({ pagos: await historialCliente(url.searchParams.get('ref') ?? '') })
      case 'contable':
        return NextResponse.json(
          await reporteContable(url.searchParams.get('inicio') ?? '', url.searchParams.get('fin') ?? '')
        )
      default:
        return NextResponse.json({ error: 'Acción no encontrada.' }, { status: 404 })
    }
  } catch (e) {
    return responderError(e)
  }
}

export async function POST(request: Request, ctx: Ctx) {
  if (!cookiePosValida(request.headers.get('cookie'))) return noAutorizado()
  const { accion } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  try {
    switch (accion) {
      case 'venta':
        return NextResponse.json(await registrarVenta(body as never))
      case 'productos':
        return NextResponse.json({ producto: await guardarProducto(body as never) })
      case 'externos':
        return NextResponse.json({ externo: await guardarExterno(body as never) })
      case 'entrega':
        await marcarEntrega((body.ids as number[]) ?? [], body.entregado === true)
        return NextResponse.json({ ok: true })
      case 'cancelar':
        return NextResponse.json({ canceladas: await cancelarPartidas((body.ids as number[]) ?? []) })
      default:
        return NextResponse.json({ error: 'Acción no encontrada.' }, { status: 404 })
    }
  } catch (e) {
    return responderError(e)
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  if (!cookiePosValida(request.headers.get('cookie'))) return noAutorizado()
  const { accion } = await ctx.params
  const id = Number(new URL(request.url).searchParams.get('id'))
  try {
    if (accion === 'externos' && Number.isInteger(id) && id > 0) {
      await eliminarExterno(id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Acción no encontrada.' }, { status: 404 })
  } catch (e) {
    return responderError(e)
  }
}
