import { NextResponse } from 'next/server'
import {
  listarDestinatariosCorreoMasivo,
  type FiltroAdicionalCorreo,
} from '@/lib/correoMasivoService'

function parseIntParam(v: string | null): number | null {
  if (v == null || v === '' || v === '0') return null
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

const FILTROS_VALIDOS: FiltroAdicionalCorreo[] = [
  'sin-filtro',
  'becados',
  'nuevo-ingreso',
  'reinscritos',
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ciclo = parseInt(searchParams.get('ciclo') ?? '', 10)
  if (Number.isNaN(ciclo) || ciclo <= 0) {
    return NextResponse.json({ error: 'Ciclo escolar inválido' }, { status: 400 })
  }

  const filtroRaw = searchParams.get('filtroAdicional') ?? 'sin-filtro'
  const filtroAdicional = FILTROS_VALIDOS.includes(filtroRaw as FiltroAdicionalCorreo)
    ? (filtroRaw as FiltroAdicionalCorreo)
    : 'sin-filtro'

  const destinatarios = await listarDestinatariosCorreoMasivo({
    cicloEscolar: ciclo,
    nivel: parseIntParam(searchParams.get('nivel')),
    grado: parseIntParam(searchParams.get('grado')),
    grupo: parseIntParam(searchParams.get('grupo')),
    filtroAdicional,
  })

  return NextResponse.json({ destinatarios })
}
