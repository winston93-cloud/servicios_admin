import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { generarPdfCredenciales } from '@/lib/credencialesPdf'
import {
  listarAlumnosCredenciales,
  listarMaestrosCredenciales,
} from '@/lib/credencialesService'
import { numeroCicloEscolarAdmin } from '@/lib/cicloEscolarAdmin'

export const runtime = 'nodejs'
export const maxDuration = 120

function parseRefs(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tipo = body.tipo === 'maestros' ? 'maestros' : 'alumnos'

    let cicloEscolar = Number(body.cicloEscolar)
    if (!cicloEscolar || Number.isNaN(cicloEscolar)) {
      const supabase = createSupabaseAdmin()
      const { data: actual } = await supabase
        .from('ciclos_escolares')
        .select('valor')
        .eq('es_actual', true)
        .maybeSingle()
      cicloEscolar = actual?.valor ?? numeroCicloEscolarAdmin()
    }

    const supabase = createSupabaseAdmin()

    const personas =
      tipo === 'maestros'
        ? await listarMaestrosCredenciales(supabase, {
            nivel: Number(body.nivel) || undefined,
          })
        : await listarAlumnosCredenciales(supabase, {
            cicloEscolar,
            nivel: Number(body.nivel) || undefined,
            grado: Number(body.grado) || undefined,
            grupo: Number(body.grupo) || undefined,
            refs: parseRefs(body.controles),
          })

    if (!personas.length) {
      return NextResponse.json(
        { error: 'No se encontraron registros con los filtros seleccionados' },
        { status: 404 }
      )
    }

    const pdfBuffer = await generarPdfCredenciales(supabase, personas)

    return NextResponse.json({
      ok: true,
      tipo,
      total: personas.length,
      pdfBase64: pdfBuffer.toString('base64'),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al generar credenciales'
    console.error('credenciales/generar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
