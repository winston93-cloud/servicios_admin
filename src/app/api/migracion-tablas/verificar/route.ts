import { NextResponse } from 'next/server'
import { getMysqlLegacyConfig } from '@/lib/mysqlLegacy'
import { ejecutarVerificacionEspejo } from '@/lib/migracionTablasVerificacion'

export const runtime = 'nodejs'
export const maxDuration = 300

function autorizado(request: Request): boolean {
  const secreto = process.env.MIGRACION_SECRET?.trim()
  if (!secreto) return true
  return request.headers.get('x-migracion-secret') === secreto
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'Secreto de migración inválido' }, { status: 401 })
  }

  if (!getMysqlLegacyConfig()) {
    return NextResponse.json(
      {
        error:
          'Falta configuración MySQL. En Vercel: Settings → Environment Variables → MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.',
      },
      { status: 503 }
    )
  }

  let tablas: string[] | undefined

  try {
    const body = await request.json()
    if (Array.isArray(body?.tablas) && body.tablas.every((t: unknown) => typeof t === 'string')) {
      tablas = body.tablas as string[]
    }
  } catch {
    /* cuerpo vacío */
  }

  try {
    const resultado = await ejecutarVerificacionEspejo({ tablas })
    return NextResponse.json(resultado)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error('Verificación espejo:', e)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
