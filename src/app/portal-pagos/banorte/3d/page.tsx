import Link from 'next/link'
import Banorte3dForm from './Banorte3dForm'
import {
  obtenerAfiliacion3ds,
  urlRespuestaBanorteComercio,
  urlPortalPagosAlumno,
} from '@/lib/banorteConfig'
import { guardarMontoPendienteBanorte, normalizarReferenciaBanorte, pagosMismoConcepto } from '@/lib/banortePagoService'
import { esEstatusBloqueo } from '@/lib/alumnoStatus'
import { evaluarBloqueoCupoPortal } from '@/lib/cupoInscripcionPrimaria'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import {
  esConceptoInscripcionReinscripcion,
  nivelCobroDesdeReferencia,
} from '@/lib/nivelCobroElectronico'
import { parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
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
  const nivelQuery = parseInt(param(q.nivel), 10) || 0
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

    // Misma regla que comercio.php / callback: nivel desde ficha + concepto de la referencia.
    // No confiar solo en ?nivel= del portal (evita cruce Winston ↔ Educativo 3DS/Payw).
    const ref5 = referencia.slice(0, 5)
    const { data: alumno } = await supabase
      .from('alumno')
      .select(
        'alumno_nivel, alumno_grado, alumno_ciclo_escolar, alumno_status, alumno_nuevo_ingreso'
      )
      .eq('alumno_ref', parseInt(ref5, 10))
      .maybeSingle()

    if (alumno && esEstatusBloqueo(Number(alumno.alumno_status))) {
      const parsed = parsearReferenciaPago(referencia)
      const cicloSistema = await obtenerCicloEscolarActual()
      const cicloPago = parsed?.cicloEscolar ?? 0
      const conceptoNo = parsed?.conceptoNo ?? ''
      if (esConceptoInscripcionReinscripcion(conceptoNo)) {
        return (
          <div className="banorte-body">
            <link rel="stylesheet" href="/banorte-flow.css" />
            <main className="banorte-main">
              <section className="banorte-card banorte-result banorte-result--error">
                <h1 className="banorte-result-title">Pago no permitido</h1>
                <p className="banorte-result-msg">
                  Con bloqueo académico o psicológico no puedes pagar inscripción del ciclo nuevo.
                </p>
                <Link href={urlPortalPagosAlumno()} className="banorte-btn banorte-btn--primary">
                  Ir al portal
                </Link>
              </section>
            </main>
          </div>
        )
      }
      if (cicloSistema && cicloPago >= cicloSistema.valor) {
        return (
          <div className="banorte-body">
            <link rel="stylesheet" href="/banorte-flow.css" />
            <main className="banorte-main">
              <section className="banorte-card banorte-result banorte-result--error">
                <h1 className="banorte-result-title">Pago no permitido</h1>
                <p className="banorte-result-msg">
                  Con bloqueo académico o psicológico solo puedes pagar pendientes del ciclo
                  anterior.
                </p>
                <Link href={urlPortalPagosAlumno()} className="banorte-btn banorte-btn--primary">
                  Ir al portal
                </Link>
              </section>
            </main>
          </div>
        )
      }
    }

    if (alumno) {
      const parsedCupo = parsearReferenciaPago(referencia)
      const conceptoCupo = parsedCupo?.conceptoNo ?? ''
      if (esConceptoInscripcionReinscripcion(conceptoCupo)) {
        const cicloSistemaCupo = await obtenerCicloEscolarActual()
        if (cicloSistemaCupo) {
          const cupo = await evaluarBloqueoCupoPortal({
            alumno: {
              alumno_ref: ref5,
              alumno_nivel: Number(alumno.alumno_nivel ?? 0),
              alumno_grado: Number(alumno.alumno_grado ?? 0),
              alumno_ciclo_escolar: Number(alumno.alumno_ciclo_escolar ?? 0),
              alumno_nuevo_ingreso: Number(alumno.alumno_nuevo_ingreso ?? 1),
            },
            cicloTemporadaActual: cicloSistemaCupo.valor,
            yaInscrito: false,
            cicloInscripcion: parsedCupo?.cicloEscolar,
          })
          if (cupo) {
            return (
              <div className="banorte-body">
                <link rel="stylesheet" href="/banorte-flow.css" />
                <main className="banorte-main">
                  <section className="banorte-card banorte-result banorte-result--error">
                    <h1 className="banorte-result-title">Cupo completo</h1>
                    <p className="banorte-result-msg">{cupo.mensaje}</p>
                    <Link
                      href={urlPortalPagosAlumno()}
                      className="banorte-btn banorte-btn--primary"
                    >
                      Ir al portal
                    </Link>
                  </section>
                </main>
              </div>
            )
          }
        }
      }
    }

    if (param(q.confirmar) !== '1') {
      const previos = await pagosMismoConcepto(supabase, referencia)
      if (previos.length) {
        const otra = new URLSearchParams()
        for (const [k, v] of Object.entries(q)) if (typeof v === 'string') otra.set(k, v)
        otra.set('confirmar', '1')
        const fmt = (iso: string) =>
          iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Monterrey', dateStyle: 'long', timeStyle: 'short' }) : 'fecha no disponible'
        return (
          <div className="banorte-body">
            <link rel="stylesheet" href="/banorte-flow.css" />
            <main className="banorte-main">
              <section className="banorte-card banorte-result banorte-result--error">
                <h1 className="banorte-result-title">Este concepto ya tiene un pago</h1>
                <p className="banorte-result-msg">
                  Ya registramos {previos.length === 1 ? 'un pago' : `${previos.length} pagos`} de «{concepto}»:
                </p>
                <ul className="banorte-result-msg">
                  {previos.map((p) => (
                    <li key={p.referencia}>
                      ${p.importe.toFixed(2)} · {fmt(p.fecha)} · referencia <code>{p.referencia}</code>
                    </li>
                  ))}
                </ul>
                <p className="banorte-result-msg">
                  Si su pago anterior mostró un error, revise primero su historial: es probable que sí se haya cobrado.
                </p>
                <div className="banorte-actions">
                  <Link href={urlPortalPagosAlumno()} className="banorte-btn banorte-btn--primary">
                    Ver mi historial
                  </Link>
                  <a href={`?${otra.toString()}`} className="banorte-btn banorte-btn--ghost">
                    Sí, quiero pagar otra vez
                  </a>
                </div>
              </section>
            </main>
          </div>
        )
      }
    }

    const nivel = alumno
      ? nivelCobroDesdeReferencia(
          {
            alumno_nivel: Number(alumno.alumno_nivel ?? 0),
            alumno_grado: Number(alumno.alumno_grado ?? 0),
            alumno_ciclo_escolar: Number(alumno.alumno_ciclo_escolar ?? 0),
          },
          referencia
        )
      : nivelQuery

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
          <p>Comercio electrónico Banorte · Payworks · tarjetas de cualquier banco</p>
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
