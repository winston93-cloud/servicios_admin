import { NextResponse } from 'next/server'
import { getMysqlLegacyConfig } from '@/lib/mysqlLegacy'
import {
  ejecutarMigracionTablas,
  type ModoMigracion,
} from '@/lib/migracionTablasService'
import {
  GRUPOS_MIGRACION,
  TABLAS_MIGRACION,
} from '@/lib/migracionTablasManifest'

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
    grupos: GRUPOS_MIGRACION,
    tablas: TABLAS_MIGRACION.map((t) => ({
      id: t.id,
      etiqueta: t.etiqueta,
      grupo: t.grupo,
      mysql: t.mysql,
      supabase: t.supabase,
    })),
  })
}

function parseModo(v: unknown): ModoMigracion {
  if (v === 'solo_upsert' || v === 'vaciar_copiar' || v === 'espejo') return v
  return 'espejo'
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

  let modo: ModoMigracion = 'espejo'
  let tablas: string[] | undefined

  try {
    const body = await request.json()
    modo = parseModo(body?.modo)
    if (Array.isArray(body?.tablas) && body.tablas.every((t: unknown) => typeof t === 'string')) {
      tablas = body.tablas as string[]
    }
    // Compatibilidad API anterior
    if (typeof body?.vaciarDestino === 'boolean') {
      modo = body.vaciarDestino ? 'vaciar_copiar' : 'solo_upsert'
    }
  } catch {
    /* cuerpo vacío */
  }

  try {
    const resultado = await ejecutarMigracionTablas({ modo, tablas })
    return NextResponse.json(resultado)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error('Migración tablas:', e)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
