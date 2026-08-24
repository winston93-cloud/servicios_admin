import { NextResponse } from 'next/server'
import { jsonRacError, requireRacSession } from '@/lib/racAuth'
import { cicloRac, listarAsignaciones } from '@/lib/racService'
import { etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'

export async function GET(req: Request) {
  try {
    const session = await requireRacSession(req)
    const ciclo = await cicloRac()
    const asign = await listarAsignaciones(session)
    return NextResponse.json({
      me: {
        role: session.role,
        perfil: session.perfil,
        id: session.id,
        nombre: session.nombre,
        usuario: session.usuario,
        cicloActual: ciclo,
        ciclos: opcionesCicloBoletas(ciclo),
        etiquetaCiclo: etiquetaCicloBoletas(ciclo),
      },
      ...asign,
    })
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
