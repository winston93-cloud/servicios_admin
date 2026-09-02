'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import {
  CicloEscolarProvider,
  useCicloEscolar,
} from '@/contexts/CicloEscolarContext'
import AlumnoAutocomplete from '@/app/servicios/components/AlumnoAutocomplete'
import {
  grupoALetra,
  type AlumnoBusquedaResultado,
} from '@/lib/alumnoBusquedaServicios'
import type {
  RevisionInscripcionResultado,
} from '@/lib/revisionPagadosInscripcion'
import './revision-pagados.css'

const LOGO_EDUCATIVO = '/logos/logo-winston-educativo.png'
const LOGO_WINSTON = '/logos/logo-winston-w.png'

export default function RevisionPagadosPage() {
  // Acceso directo (entrada al colegio): sin login; URL pública bookmarkable.
  return (
    <CicloEscolarProvider>
      <RevisionPagadosView />
    </CicloEscolarProvider>
  )
}

function RevisionPagadosView() {
  const { cicloInscripcionSistema, etiquetaCicloInscripcionSistema } =
    useCicloEscolar()
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const [alumno, setAlumno] = useState<AlumnoBusquedaResultado | null>(null)
  const [data, setData] = useState<RevisionInscripcionResultado | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (a: AlumnoBusquedaResultado) => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('/api/revision-pagados/inscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId: a.alumno_id }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo consultar la inscripción.')
      }
      setData(json as RevisionInscripcionResultado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar')
    } finally {
      setLoading(false)
    }
  }, [])

  const onSeleccionar = useCallback(
    (a: AlumnoBusquedaResultado | null) => {
      setAlumno(a)
      setError(null)
      setData(null)
      if (a) void cargar(a)
    },
    [cargar]
  )

  const revisarOtro = useCallback(() => {
    setAlumno(null)
    setData(null)
    setError(null)
    // Refocus search for the next child at the gate
    window.setTimeout(() => {
      const input = searchWrapRef.current?.querySelector('input')
      if (input instanceof HTMLInputElement) {
        input.focus()
        input.select()
      }
    }, 50)
  }, [])

  const cicloEscolarLabel =
    etiquetaCicloInscripcionSistema ||
    (cicloInscripcionSistema != null
      ? `${cicloInscripcionSistema + 2003}-${cicloInscripcionSistema + 2004}`
      : null)
  const cicloHint = cicloEscolarLabel
    ? `Ciclo escolar ${cicloEscolarLabel}`
    : 'Ciclo vigente'

  return (
    <div className={`rev-pag-page${data ? ' rev-pag-page--con-resultado' : ''}`}>
      <div className="rev-pag-bg" aria-hidden>
        <span className="rev-pag-orb rev-pag-orb--a" />
        <span className="rev-pag-orb rev-pag-orb--b" />
      </div>

      <header className="rev-pag-top">
        <Link href="/dashboard" className="rev-pag-back">
          <ArrowLeft size={16} aria-hidden />
          Dashboard
        </Link>
        <div className="rev-pag-top-meta">
          <span className="rev-pag-pill">{cicloHint}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="rev-pag-main">
        <section className="rev-pag-hero">
          <div className="rev-pag-hero-line">
            <div className="rev-pag-hero-copy">
              <p className="rev-pag-kicker">Entrada al colegio</p>
              <h1>Revisión Pagados / No Pagados</h1>
            </div>
            <div className="rev-pag-planteles-legend">
              <span className="rev-pag-plantel-tag rev-pag-plantel-tag--educativo">
                <Image
                  src={LOGO_EDUCATIVO}
                  alt=""
                  width={36}
                  height={28}
                  className="rev-pag-plantel-logo"
                />
                Educativo
              </span>
              <span className="rev-pag-plantel-tag rev-pag-plantel-tag--winston">
                <Image
                  src={LOGO_WINSTON}
                  alt=""
                  width={36}
                  height={28}
                  className="rev-pag-plantel-logo rev-pag-plantel-logo--winston"
                />
                Winston
              </span>
            </div>
          </div>
        </section>

        <section className="rev-pag-panel rev-pag-panel--buscar" ref={searchWrapRef}>
          <header className="rev-pag-panel-head rev-pag-panel-head--inline">
            <span className="rev-pag-panel-step">1</span>
            <h2 className="rev-pag-panel-title">Búsqueda</h2>
            <p className="rev-pag-panel-sub">
              Nombre o No. de control · Maternal A → 9no
            </p>
          </header>
          <div className="rev-pag-search-box">
            <AlumnoAutocomplete
              key={alumno?.alumno_id ?? 'empty'}
              onSeleccionar={onSeleccionar}
              alumnoSeleccionado={alumno}
              autoFocus
              etiqueta="Escribe nombre o No. de control"
              apiBusqueda="/api/revision-pagados/buscar"
            />
          </div>
        </section>

        <section className="rev-pag-panel rev-pag-panel--resultado" aria-live="polite">
          <header className="rev-pag-panel-head rev-pag-panel-head--inline">
            <span className="rev-pag-panel-step">2</span>
            <h2 className="rev-pag-panel-title">Resultado</h2>
            <p className="rev-pag-panel-sub">
              Plantel · inscripción completa o incompleta
            </p>
          </header>

          {loading ? (
            <div className="rev-pag-loading" role="status">
              <Loader2 className="rev-pag-spin" size={32} aria-hidden />
              Consultando inscripción…
            </div>
          ) : null}

          {error ? (
            <div className="rev-pag-error" role="alert">
              {error}
            </div>
          ) : null}

          {data ? (
            <ResultadoInscripcion data={data} onOtro={revisarOtro} />
          ) : !loading && !error ? (
            <div className="rev-pag-idle">
              <p>
                El resultado aparecerá aquí. Escribe al menos 2 letras o el No.
                de control.
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

function ResultadoInscripcion({
  data,
  onOtro,
}: {
  data: RevisionInscripcionResultado
  onOtro: () => void
}) {
  const ok = data.pagado
  const grupo =
    data.alumno.grupo != null ? grupoALetra(data.alumno.grupo) : null

  return (
    <section
      className={`rev-pag-result ${ok ? 'rev-pag-result--ok' : 'rev-pag-result--bad'} rev-pag-result--${data.alumno.plantel}`}
      aria-live="polite"
    >
      <div
        className={`rev-pag-plantel-banner rev-pag-plantel-banner--${data.alumno.plantel}`}
      >
        <Image
          src={
            data.alumno.plantel === 'educativo' ? LOGO_EDUCATIVO : LOGO_WINSTON
          }
          alt=""
          width={56}
          height={42}
          className={`rev-pag-plantel-banner-logo${data.alumno.plantel === 'winston' ? ' rev-pag-plantel-banner-logo--winston' : ''}`}
        />
        <div className="rev-pag-plantel-banner-text">
          <span className="rev-pag-plantel-banner-kicker">Plantel</span>
          <strong className="rev-pag-plantel-banner-name">
            {data.alumno.plantel_label}
          </strong>
          <span className="rev-pag-plantel-banner-razon">
            {data.alumno.plantel_razon}
          </span>
        </div>
      </div>

      <div className="rev-pag-verdict">
        <div className="rev-pag-verdict-icon" aria-hidden>
          {ok ? <CheckCircle2 size={56} strokeWidth={1.75} /> : <XCircle size={56} strokeWidth={1.75} />}
        </div>
        <div className="rev-pag-verdict-copy">
          <p className="rev-pag-verdict-label">
            {ok ? 'Inscripción completa' : 'Inscripción incompleta'}
          </p>
          {ok && data.completa_por ? (
            <p className="rev-pag-completa-por">
              Completa por concepto{' '}
              <strong>{data.completa_por}</strong>
              {data.completa_por === '13'
                ? ' · Inscripción (pago único)'
                : ' · Diferido 2'}
            </p>
          ) : null}
          <h3 className="rev-pag-name">{data.alumno.nombre_completo}</h3>
          <p className="rev-pag-meta">
            <span className="rev-pag-ref">{data.alumno.alumno_ref}</span>
            <span>
              {data.alumno.nivel_label} · {data.alumno.grado_label}
              {grupo ? ` · ${grupo}` : ''}
            </span>
            <span>
              {data.alumno.es_reinscrito ? 'Reinscrito' : 'Nuevo ingreso'}
            </span>
          </p>
        </div>
      </div>

      <div className="rev-pag-chips">
        <span className={`rev-pag-chip ${ok ? 'rev-pag-chip--ok' : 'rev-pag-chip--bad'}`}>
          {ok ? '✓ Completa' : '✕ Incompleta'}
        </span>
        <span className="rev-pag-chip">{data.modalidad_label}</span>
        <span className="rev-pag-chip rev-pag-chip--muted">
          Ciclo escolar {data.ciclo_label?.replace(/^Ciclo\s+/i, '') || data.ciclo_inscripcion}
        </span>
        {data.tiene_pago_unico ? (
          <span className="rev-pag-chip rev-pag-chip--ok">13 · Inscripción</span>
        ) : null}
        {data.tiene_dif2 ? (
          <span className="rev-pag-chip rev-pag-chip--ok">12 · Diferido 2</span>
        ) : null}
        {data.tiene_dif1 ? (
          <span
            className={`rev-pag-chip ${data.tiene_dif2 || data.tiene_pago_unico ? 'rev-pag-chip--ok' : 'rev-pag-chip--warn'}`}
          >
            11 · Diferido 1
          </span>
        ) : null}
        {!data.tiene_dif2 && !data.tiene_pago_unico && data.tiene_dif1 ? (
          <span className="rev-pag-chip rev-pag-chip--bad">Falta 12</span>
        ) : null}
        {!data.tiene_dif1 && !data.tiene_dif2 && !data.tiene_pago_unico ? (
          <span className="rev-pag-chip rev-pag-chip--bad">Falta 13 o 12</span>
        ) : null}
      </div>

      <p className="rev-pag-resumen">{data.resumen}</p>

      <div className="rev-pag-actions">
        <button type="button" className="rev-pag-btn-otro" onClick={onOtro}>
          <RefreshCw size={18} aria-hidden />
          Revisar otro alumno
        </button>
      </div>
    </section>
  )
}
