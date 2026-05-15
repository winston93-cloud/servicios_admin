import { NextResponse } from 'next/server'
import { getMysqlLegacyConfig } from '@/lib/mysqlLegacy'
import { ejecutarMigracionAlumno } from '@/lib/migracionAlumnoService'

export const runtime = 'nodejs'
export const maxDuration = 300

function autorizado(request: Request): boolean {
  const secreto = process.env.MIGRACION_SECRET?.trim()
  if (!secreto) return true
  return request.headers.get('x-migracion-secret') === secreto
}

export async function GET() {
  const mysql = getMysqlLegacyConfig()
  return NextResponse.json({
    listo: Boolean(mysql),
    mysql: mysql
      ? { host: mysql.host, database: mysql.database, port: mysql.port }
      : null,
    requiereSecreto: Boolean(process.env.MIGRACION_SECRET?.trim()),
  })
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'Secreto de migración inválido' }, { status: 401 })
  }

  if (!getMysqlLegacyConfig()) {
    return NextResponse.json(
      {
        error:
          'Falta configuración MySQL. Agrega MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD en .env.local',
      },
      { status: 503 }
    )
  }

  let vaciarDestino = true
  try {
    const body = await request.json()
    if (typeof body?.vaciarDestino === 'boolean') {
      vaciarDestino = body.vaciarDestino
    }
  } catch {
    /* cuerpo vacío: defaults */
  }

  try {
    const resultado = await ejecutarMigracionAlumno({ vaciarDestino })
    return NextResponse.json(resultado)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error('Migración alumno:', e)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
