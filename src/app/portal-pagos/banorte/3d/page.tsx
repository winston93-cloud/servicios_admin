import Link from 'next/link'
import Banorte3dForm from './Banorte3dForm'
import {
  obtenerAfiliacion3ds,
  urlRespuestaBanorteComercio,
  urlPortalPagosAlumno,
} from '@/lib/banorteConfig'
import { guardarMontoPendienteBanorte, normalizarReferenciaBanorte } from '@/lib/banortePagoService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function Banorte3dPage({ searchParams }: PageProps) {
  const q = await searchParams
  const referencia = normalizarReferenciaBanorte(param(q.referencia))
  const montoRaw = param(q.monto)
  const concepto = param(q.concepto) || 'Pago escolar'
  const nivel = parseInt(param(q.nivel), 10) || 0
  const monto = Number.parseFloat(montoRaw)

  if (referencia.length !== 12 || !Number.isFinite(monto) || monto <= 0) {
    return (
      <div className="banorte-body">
        <link rel="stylesheet" href="/banorte-flow.css" />
        <main className="banorte-main">
          <section className="banorte-card banorte-result banorte-result--error">
            <h1 className="banorte-result-title">Datos incompletos</h1>
            <p className="banorte-result-msg">
              Inicie el pago desde el portal de colegiaturas (referencia e importe son obligatorios).
            </p>
            <Link href={urlPortalPagosAlumno()} className="banorte-btn banorte-btn--primary">
              Ir al portal
            </Link>
          </section>
        </main>
      </div>
    )
  }

  const montoFmt = monto.toFixed(2)

  try {
    const supabase = createSupabaseAdmin()
    await guardarMontoPendienteBanorte(supabase, referencia, monto)
    const afiliacion = obtenerAfiliacion3ds(nivel)
    const urlRespuesta = urlRespuestaBanorteComercio()

    return (
      <div className="banorte-body">
        <link rel="stylesheet" href="/banorte-flow.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif&display=swap"
          rel="stylesheet"
        />
        <div className="banorte-bg" aria-hidden="true" />
        <header className="banorte-header">
          <div className="banorte-brand">
            <span className="banorte-brand-mark">W</span>
            <div>
              <p className="banorte-brand-title">Pago seguro</p>
              <p className="banorte-brand-sub">{afiliacion.nombreComercio}</p>
            </div>
          </div>
          <ol className="banorte-steps" aria-label="Progreso">
            <li className="banorte-step banorte-step--active">
              <span>1</span> Verificación 3D Secure
            </li>
            <li className="banorte-step">
              <span>2</span> Cargo a tarjeta
            </li>
          </ol>
        </header>
        <main className="banorte-main">
          <div className="banorte-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/portal-pagos/banorte/seguridad.png"
              alt="Pago seguro en línea"
              className="banorte-hero-img"
              width={788}
              height={441}
            />
          </div>
          <Banorte3dForm
            referencia={referencia}
            monto={montoFmt}
            concepto={concepto}
            afiliacion={afiliacion}
            urlRespuesta={urlRespuesta}
          />
        </main>
        <footer className="banorte-footer">
          <p>Transacción procesada por Banorte · Payworks</p>
        </footer>
      </div>
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo iniciar el pago.'
    return (
      <div className="banorte-body">
        <link rel="stylesheet" href="/banorte-flow.css" />
        <main className="banorte-main">
          <section className="banorte-card banorte-result banorte-result--error">
            <h1 className="banorte-result-title">Configuración pendiente</h1>
            <p className="banorte-result-msg">{msg}</p>
            <Link href={urlPortalPagosAlumno()} className="banorte-btn banorte-btn--primary">
              Volver al portal
            </Link>
          </section>
        </main>
      </div>
    )
  }
}
