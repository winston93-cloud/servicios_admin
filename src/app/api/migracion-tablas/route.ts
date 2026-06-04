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
/** Máximo permitido en Vercel Hobby (1–300 s). Migración grande: una tabla por petición desde la UI. */
export const maxDuration = 300

function autorizado(request: Request): boolean {
  const secreto = process.env.MIGRACION_SECRET?.trim()
  if (!secreto) return true
  return request.headers.get('x-migracion-secret') === secreto
}

export async function GET() {
  const mysql = getMysqlLegacyConfig()
  const insforgeUrl =
    process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL ?? null
  const insforgeListo = Boolean(insforgeUrl && process.env.INSFORGE_API_KEY?.trim())
  return NextResponse.json({
    listo: Boolean(mysql) && insforgeListo,
    mysql: mysql
      ? { host: mysql.host, database: mysql.database, port: mysql.port }
      : null,
    insforge: insforgeListo
      ? { url: insforgeUrl, proyecto: 'Winston Servicios' }
      : null,
    requiereSecreto: Boolean(process.env.MIGRACION_SECRET?.trim()),
    grupos: GRUPOS_MIGRACION,
    tablas: TABLAS_MIGRACION.map((t) => ({
      id: t.id,
      etiqueta: t.etiqueta,
      grupo: t.grupo,
      mysql: t.mysql,
      destino: t.destino,
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
  let faseVaciarCopiar: 'vaciar' | 'copiar' | undefined

  try {
    const body = await request.json()
    modo = parseModo(body?.modo)
    if (Array.isArray(body?.tablas) && body.tablas.every((t: unknown) => typeof t === 'string')) {
      tablas = body.tablas as string[]
    }
    if (body?.faseVaciarCopiar === 'vaciar' || body?.faseVaciarCopiar === 'copiar') {
      faseVaciarCopiar = body.faseVaciarCopiar
    }
    // Compatibilidad API anterior
    if (typeof body?.vaciarDestino === 'boolean') {
      modo = body.vaciarDestino ? 'vaciar_copiar' : 'solo_upsert'
    }
  } catch {
    /* cuerpo vacío */
  }

  try {
    const resultado = await ejecutarMigracionTablas({ modo, tablas, faseVaciarCopiar })
    return NextResponse.json(resultado)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error('Migración tablas:', e)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
