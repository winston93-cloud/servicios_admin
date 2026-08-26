import { NextResponse } from 'next/server'
import { etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'
import { cfgDesdeRequestSlug, jsonRacNivelError, requireRacNivelSession } from '@/lib/rac/racAuthNivel'
import { getServiceForSlug } from '@/lib/rac/racServiceNivel'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const session = await requireRacNivelSession(cfg, req)
    const svc = getServiceForSlug(slug)
    const ciclo = await svc.cicloRac()
    const asign = await svc.listarAsignaciones(session)
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
        nivelSlug: cfg.slug,
      },
      ...asign,
      config: {
        titulo: cfg.titulo,
        subtitulo: cfg.subtitulo,
        kicker: cfg.kicker,
        modoGradoGrupo: cfg.modoGradoGrupo,
        etiquetaOperaciones: cfg.etiquetaOperaciones,
      },
    })
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
