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

  let aviso: string | null = null
  if (!destinatarios.length) {
    if (filtroAdicional === 'becados') {
      aviso =
        'No hay becas activas para ese ciclo, o los alumnos becados ya no están activos. En «Becados», el ciclo es el de la beca (p. ej. 22), no hace falta que coincida con la ficha actual del alumno.'
    } else if (filtroAdicional === 'nuevo-ingreso') {
      aviso =
        'No hay alumnos de nuevo ingreso activos en ese ciclo escolar. Prueba el ciclo vigente.'
    } else if (filtroAdicional === 'reinscritos') {
      aviso =
        'No hay reinscritos activos en ese ciclo escolar. Prueba el ciclo vigente.'
    } else {
      aviso =
        'No hay alumnos activos con esos filtros. Tras el avance de temporada, usa el ciclo vigente para listados generales (sin filtro / nuevo ingreso / reinscritos).'
    }
  }

  return NextResponse.json({ destinatarios, aviso })
}
